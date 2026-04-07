import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	suspendWorkflowAtGate,
	resumeWorkflowAfterGate,
	processHumanGateDecision,
} from '../../../lib/workflow/humanGateHandling';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { createGate, resolveGate } from '../../../lib/workflow/gates';
import { GateStatus, HumanAction, Phase } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';
import { randomUUID } from 'node:crypto';

describe('HumanGateHandling', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;
	let gateId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();

		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(dialogueId);

		initializeWorkflowState(dialogueId);

		// Create a real gate so suspensions have a valid FK target.
		// Tests that need a specific gate can overwrite `gateId` in their own setup.
		const gateResult = createGate({
			dialogueId,
			reason: 'Default test gate',
			blockingClaims: [],
		});
		gateId = gateResult.success ? gateResult.value.gate_id : randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('suspendWorkflowAtGate', () => {
		it('creates suspension record', () => {
			const result = suspendWorkflowAtGate(dialogueId, gateId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.suspension_id).toBeDefined();
				expect(result.value.dialogue_id).toBe(dialogueId);
				expect(result.value.gate_id).toBe(gateId);
				expect(result.value.suspended_phase).toBe(Phase.INTAKE);
				expect(result.value.resumed_at).toBeNull();
			}
		});

		it('records suspension timestamp', () => {
			const result = suspendWorkflowAtGate(dialogueId, gateId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.suspended_at).toBeDefined();
				const timestamp = new Date(result.value.suspended_at);
				expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
			}
		});

		it('sets timeout when specified', () => {
			const timeoutMinutes = 60;
			const result = suspendWorkflowAtGate(dialogueId, gateId, timeoutMinutes);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.timeout_at).toBeDefined();
				if (result.value.timeout_at) {
					const timeout = new Date(result.value.timeout_at);
					const now = new Date();
					const diff = (timeout.getTime() - now.getTime()) / 1000 / 60;
					expect(diff).toBeGreaterThan(55);
					expect(diff).toBeLessThan(65);
				}
			}
		});

		it('handles suspension without timeout', () => {
			const result = suspendWorkflowAtGate(dialogueId, gateId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.timeout_at).toBeNull();
			}
		});

		it('updates workflow metadata', () => {
			const result = suspendWorkflowAtGate(dialogueId, gateId);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const state = db
				.prepare('SELECT metadata FROM workflow_states WHERE dialogue_id = ?')
				.get(dialogueId) as { metadata: string };

			const metadata = JSON.parse(state.metadata);
			expect(metadata.suspended).toBe(true);
			expect(metadata.suspendedAt).toBeDefined();
		});

		it('handles nonexistent dialogue', () => {
			const result = suspendWorkflowAtGate('nonexistent', gateId);
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = suspendWorkflowAtGate(dialogueId, gateId);
			expect(result.success).toBe(false);
		});
	});

	describe('resumeWorkflowAfterGate', () => {
		it('resumes workflow after gate resolution', () => {
			suspendWorkflowAtGate(dialogueId, gateId);

			const createResult = createGate({
				dialogueId,
				reason: 'Test gate',
				blockingClaims: [],
			});
			if (createResult.success) {
				gateId = createResult.value.gate_id;
			}

			resolveGate({
				gateId,
				decisionId: randomUUID(),
				resolution: 'Approved',
			});

			const result = resumeWorkflowAfterGate(dialogueId, gateId);
			expect(result.success).toBe(true);
		});

		it('updates suspension record with resumed timestamp', () => {
			suspendWorkflowAtGate(dialogueId, gateId);

			const createResult = createGate({
				dialogueId,
				reason: 'Test gate',
				blockingClaims: [],
			});
			if (createResult.success) {
				gateId = createResult.value.gate_id;
			}

			resolveGate({
				gateId,
				decisionId: randomUUID(),
				resolution: 'Approved',
			});

			const result = resumeWorkflowAfterGate(dialogueId, gateId);
			expect(result.success).toBe(true);
			if (result.success && result.value.resumed_at) {
				const timestamp = new Date(result.value.resumed_at);
				expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
			}
		});

		it('updates workflow metadata on resume', () => {
			// Use the gate from the outer beforeEach (already exists).
			suspendWorkflowAtGate(dialogueId, gateId);

			resolveGate({
				gateId,
				decisionId: randomUUID(),
				resolution: 'Approved',
			});

			resumeWorkflowAfterGate(dialogueId, gateId);

			const db = getDatabase()!;
			const state = db
				.prepare('SELECT metadata FROM workflow_states WHERE dialogue_id = ?')
				.get(dialogueId) as { metadata: string };

			const metadata = JSON.parse(state.metadata);
			expect(metadata.suspended).toBe(false);
			expect(metadata.resumedAt).toBeDefined();
		});

		it('prevents resume when gate not resolved', () => {
			suspendWorkflowAtGate(dialogueId, gateId);

			const createResult = createGate({
				dialogueId,
				reason: 'Test gate',
				blockingClaims: [],
			});
			if (createResult.success) {
				gateId = createResult.value.gate_id;
			}

			const result = resumeWorkflowAfterGate(dialogueId, gateId);
			expect(result.success).toBe(false);
		});

		it('handles already resumed workflow', () => {
			// Use the gate from the outer beforeEach (already exists).
			suspendWorkflowAtGate(dialogueId, gateId);

			resolveGate({
				gateId,
				decisionId: randomUUID(),
				resolution: 'Approved',
			});

			resumeWorkflowAfterGate(dialogueId, gateId);
			const result = resumeWorkflowAfterGate(dialogueId, gateId);
			expect(result.success).toBe(false);
		});

		it('handles nonexistent gate', () => {
			const result = resumeWorkflowAfterGate(dialogueId, 'nonexistent');
			expect(result.success).toBe(false);
		});

		it('handles workflow without suspension record', () => {
			const createResult = createGate({
				dialogueId,
				reason: 'Test gate',
				blockingClaims: [],
			});
			if (createResult.success) {
				gateId = createResult.value.gate_id;
			}

			resolveGate({
				gateId,
				decisionId: randomUUID(),
				resolution: 'Approved',
			});

			const result = resumeWorkflowAfterGate(dialogueId, gateId);
			expect(result.success).toBe(true);
		});
	});

	describe('processHumanGateDecision', () => {
		beforeEach(() => {
			const createResult = createGate({
				dialogueId,
				reason: 'Requires human review',
				blockingClaims: [],
			});
			if (createResult.success) {
				gateId = createResult.value.gate_id;
			}
		});

		it('processes APPROVE decision', () => {
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale: 'Looks good to proceed',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.gate_id).toBe(gateId);
				expect(result.value.action).toBe(HumanAction.APPROVE);
			}
		});

		it('processes REJECT decision', () => {
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.REJECT,
				rationale: 'Security concerns',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.action).toBe(HumanAction.REJECT);
			}
		});

		it('processes OVERRIDE decision', () => {
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.OVERRIDE,
				rationale: 'Emergency deployment needed',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.action).toBe(HumanAction.OVERRIDE);
			}
		});

		it('processes REFRAME decision', () => {
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.REFRAME,
				rationale: 'Need to reconsider approach',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.action).toBe(HumanAction.REFRAME);
			}
		});

		it('processes DELEGATE decision', () => {
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.DELEGATE,
				rationale: 'Requires domain expert',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.action).toBe(HumanAction.DELEGATE);
			}
		});

		it('processes ESCALATE decision', () => {
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.ESCALATE,
				rationale: 'Above my authority',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.action).toBe(HumanAction.ESCALATE);
			}
		});

		it('resolves gate on APPROVE', () => {
			processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale: 'Approved',
				decisionMaker: 'test-user',
			});

			const db = getDatabase()!;
			const gate = db
				.prepare('SELECT status FROM gates WHERE gate_id = ?')
				.get(gateId) as { status: string };

			expect(gate.status).toBe(GateStatus.RESOLVED);
		});

		it('resolves gate on OVERRIDE', () => {
			processHumanGateDecision({
				gateId,
				action: HumanAction.OVERRIDE,
				rationale: 'Override applied',
				decisionMaker: 'test-user',
			});

			const db = getDatabase()!;
			const gate = db
				.prepare('SELECT status FROM gates WHERE gate_id = ?')
				.get(gateId) as { status: string };

			expect(gate.status).toBe(GateStatus.RESOLVED);
		});

		it('does not resolve gate on REJECT', () => {
			processHumanGateDecision({
				gateId,
				action: HumanAction.REJECT,
				rationale: 'Rejected',
				decisionMaker: 'test-user',
			});

			const db = getDatabase()!;
			const gate = db
				.prepare('SELECT status FROM gates WHERE gate_id = ?')
				.get(gateId) as { status: string };

			expect(gate.status).toBe(GateStatus.OPEN);
		});

		it('stores decision rationale', () => {
			const rationale = 'This is a detailed rationale for the decision';
			processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale,
				decisionMaker: 'test-user',
			});

			const db = getDatabase()!;
			const decision = db
				.prepare('SELECT rationale FROM human_decisions WHERE gate_id = ?')
				.get(gateId) as { rationale: string };

			expect(decision.rationale).toBe(rationale);
		});

		it('stores decision maker', () => {
			const decisionMaker = 'senior-engineer@example.com';
			processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale: 'Approved decision with rationale',
				decisionMaker,
			});

			const db = getDatabase()!;
			const decision = db
				.prepare('SELECT decision_maker FROM human_decisions WHERE gate_id = ?')
				.get(gateId) as { decision_maker: string };

			expect(decision.decision_maker).toBe(decisionMaker);
		});

		it('handles attachments', () => {
			const attachments = ['file1.txt', 'file2.pdf'];
			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale: 'Approved with documents',
				decisionMaker: 'test-user',
				attachmentsRef: attachments,
			});

			expect(result.success).toBe(true);
		});

		it('prevents decision on closed gate', () => {
			resolveGate({
				gateId,
				decisionId: randomUUID(),
				resolution: 'Already resolved',
			});

			const result = processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale: 'Late approval',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(false);
		});

		it('handles nonexistent gate', () => {
			const result = processHumanGateDecision({
				gateId: 'nonexistent',
				action: HumanAction.APPROVE,
				rationale: 'Approved',
				decisionMaker: 'test-user',
			});

			expect(result.success).toBe(false);
		});
	});

	describe('integration scenarios', () => {
		it('manages complete suspend-decide-resume flow', () => {
			const suspendResult = suspendWorkflowAtGate(dialogueId, gateId, 120);
			expect(suspendResult.success).toBe(true);

			const createResult2 = createGate({
				dialogueId,
				reason: 'Human review required',
				blockingClaims: [],
			});
			if (createResult2.success) {
				gateId = createResult2.value.gate_id;
			}

			const decisionResult = processHumanGateDecision({
				gateId,
				action: HumanAction.APPROVE,
				rationale: 'Reviewed and approved',
				decisionMaker: 'test-user',
			});
			expect(decisionResult.success).toBe(true);
		});

		it('handles rejection without resume', () => {
			suspendWorkflowAtGate(dialogueId, gateId);

			const createResult3 = createGate({
				dialogueId,
				reason: 'Security review',
				blockingClaims: [],
			});
			if (createResult3.success) {
				gateId = createResult3.value.gate_id;
			}

			const decisionResult = processHumanGateDecision({
				gateId,
				action: HumanAction.REJECT,
				rationale: 'Security risks identified',
				decisionMaker: 'security-team',
			});

			expect(decisionResult.success).toBe(true);

			const db = getDatabase()!;
			const gate = db
				.prepare('SELECT status FROM gates WHERE gate_id = ?')
				.get(gateId) as { status: string };

			expect(gate.status).toBe(GateStatus.OPEN);
		});

		it('handles multiple suspensions for same dialogue', () => {
			// Create two real gates (FK requirement on workflow_suspensions.gate_id).
			const create1 = createGate({ dialogueId, reason: 'Gate 1', blockingClaims: [] });
			const create2 = createGate({ dialogueId, reason: 'Gate 2', blockingClaims: [] });
			expect(create1.success).toBe(true);
			expect(create2.success).toBe(true);
			if (!create1.success || !create2.success) { return; }

			const suspend1 = suspendWorkflowAtGate(dialogueId, create1.value.gate_id);
			expect(suspend1.success).toBe(true);

			const suspend2 = suspendWorkflowAtGate(dialogueId, create2.value.gate_id);
			expect(suspend2.success).toBe(true);

			const db = getDatabase()!;
			const suspensions = db
				.prepare('SELECT COUNT(*) as count FROM workflow_suspensions WHERE dialogue_id = ?')
				.get(dialogueId) as { count: number };

			// The outer beforeEach + these two new gates + suspensions means 3 total
			// if the outer gate is also suspended. But this test only creates 2 NEW
			// suspensions, and the beforeEach gate is not suspended, so count is 2.
			expect(suspensions.count).toBe(2);
		});

		it('tracks timeout expiry', () => {
			const timeoutMinutes = 1;
			const result = suspendWorkflowAtGate(dialogueId, gateId, timeoutMinutes);

			expect(result.success).toBe(true);
			if (result.success && result.value.timeout_at) {
				const timeout = new Date(result.value.timeout_at);
				const now = new Date();
				expect(timeout.getTime()).toBeGreaterThan(now.getTime());
			}
		});
	});
});
