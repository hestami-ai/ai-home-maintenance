import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	initializeWorkflowState,
	getWorkflowState,
	transitionWorkflow,
	isValidTransition,
	evaluateTransitionGuards,
	updateWorkflowMetadata,
	getTransitionHistory,
	reconcileStaleTransitionGraphs,
	restoreWorkflowState,
	visualizeWorkflowState,
	TransitionTrigger,
	TRANSITION_GRAPH_VERSION,
} from '../../../lib/workflow/stateMachine';
import { Phase, GateStatus, ClaimStatus } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';
import { randomUUID } from 'node:crypto';

describe('Workflow State Machine', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	function insertDialogue(id: string): void {
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(id);
	}

	function createClaim(dialogueId: string, criticality: string, status: string): string {
		const db = getDatabase()!;
		// claims.turn_id is NOT NULL with composite FK to dialogue_events(dialogue_id, event_id).
		const turnInsert = db.prepare(`
			INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp)
			VALUES (?, 'claim', 'EXECUTOR', 'PROPOSE', 'CLAIM', 'seed turn', 'seed', datetime('now'))
		`).run(dialogueId);
		const turnId = Number(turnInsert.lastInsertRowid);

		const claimId = randomUUID();
		db.prepare(
			`INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
			 VALUES (?, 'Test claim', 'EXECUTOR', ?, ?, ?, ?, datetime('now'))`
		).run(claimId, criticality, status, dialogueId, turnId);
		return claimId;
	}

	function createGate(dialogueId: string, status: string): string {
		const db = getDatabase()!;
		const gateId = randomUUID();
		db.prepare(
			`INSERT INTO gates (gate_id, dialogue_id, reason, status, blocking_claims, created_at, resolved_at)
			 VALUES (?, ?, 'Test gate', ?, '[]', datetime('now'), NULL)`
		).run(gateId, dialogueId, status);
		return gateId;
	}

	describe('initializeWorkflowState', () => {
		it('initializes workflow state in INTAKE phase', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			const result = initializeWorkflowState(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.current_phase).toBe(Phase.INTAKE);
				expect(result.value.previous_phase).toBeNull();
				expect(result.value.dialogue_id).toBe(id);
			}
		});

		it('initializes with custom metadata', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			const result = initializeWorkflowState(id, { turnCount: 5, claimCount: 3 });
			expect(result.success).toBe(true);
			if (result.success) {
				const metadata = JSON.parse(result.value.metadata);
				expect(metadata.turnCount).toBe(5);
				expect(metadata.claimCount).toBe(3);
			}
		});

		it('prevents duplicate initialization', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			const result = initializeWorkflowState(id);
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = initializeWorkflowState('test-id');
			expect(result.success).toBe(false);
		});
	});

	describe('getWorkflowState', () => {
		it('retrieves workflow state after initialization', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
			insertDialogue(id);
			initializeWorkflowState(id);
			const result = getWorkflowState(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.current_phase).toBe(Phase.INTAKE);
			}
		});

		it('returns error for non-existent dialogue', () => {
			const result = getWorkflowState('nonexistent');
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getWorkflowState('test-id');
			expect(result.success).toBe(false);
		});
	});

	describe('isValidTransition', () => {
		it('validates allowed transitions', () => {
			expect(isValidTransition(Phase.INTAKE, Phase.ARCHITECTURE)).toBe(true);
			expect(isValidTransition(Phase.INTAKE, Phase.PROPOSE)).toBe(false);
			expect(isValidTransition(Phase.ARCHITECTURE, Phase.PROPOSE)).toBe(true);
			expect(isValidTransition(Phase.PROPOSE, Phase.ASSUMPTION_SURFACING)).toBe(true);
			expect(isValidTransition(Phase.ASSUMPTION_SURFACING, Phase.VERIFY)).toBe(true);
			expect(isValidTransition(Phase.VERIFY, Phase.HISTORICAL_CHECK)).toBe(true);
			expect(isValidTransition(Phase.HISTORICAL_CHECK, Phase.REVIEW)).toBe(true);
			expect(isValidTransition(Phase.REVIEW, Phase.EXECUTE)).toBe(true);
			expect(isValidTransition(Phase.EXECUTE, Phase.VALIDATE)).toBe(true);
			expect(isValidTransition(Phase.VALIDATE, Phase.COMMIT)).toBe(true);
			expect(isValidTransition(Phase.COMMIT, Phase.INTAKE)).toBe(true);
			expect(isValidTransition(Phase.INTAKE, Phase.INTAKE)).toBe(true);
			expect(isValidTransition(Phase.ARCHITECTURE, Phase.ARCHITECTURE)).toBe(true);
		});

		it('validates REPLAN transitions', () => {
			expect(isValidTransition(Phase.PROPOSE, Phase.REPLAN)).toBe(true);
			expect(isValidTransition(Phase.VERIFY, Phase.REPLAN)).toBe(true);
			expect(isValidTransition(Phase.REVIEW, Phase.REPLAN)).toBe(true);
			expect(isValidTransition(Phase.REPLAN, Phase.PROPOSE)).toBe(true);
		});

		it('rejects invalid transitions', () => {
			expect(isValidTransition(Phase.INTAKE, Phase.EXECUTE)).toBe(false);
			expect(isValidTransition(Phase.VERIFY, Phase.COMMIT)).toBe(false);
			expect(isValidTransition(Phase.COMMIT, Phase.EXECUTE)).toBe(false);
			expect(isValidTransition(Phase.INTAKE, Phase.VERIFY)).toBe(false);
		});
	});

	describe('evaluateTransitionGuards', () => {
		it('allows transition when no blocking conditions', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = evaluateTransitionGuards(id, Phase.INTAKE, Phase.ARCHITECTURE);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.canTransition).toBe(true);
			}
		});

		it('blocks transition for invalid phase transition', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = evaluateTransitionGuards(id, Phase.INTAKE, Phase.EXECUTE);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.canTransition).toBe(false);
			}
		});

		it('blocks transition for open gates', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			createGate(id, GateStatus.OPEN);

			const result = evaluateTransitionGuards(id, Phase.INTAKE, Phase.ARCHITECTURE);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.canTransition).toBe(false);
				expect(result.value.reason).toContain('Open gates');
			}
		});

		it('blocks transition for critical disproved claims', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			createClaim(id, 'CRITICAL', ClaimStatus.DISPROVED);
			createGate(id, GateStatus.OPEN);

			const result = evaluateTransitionGuards(id, Phase.INTAKE, Phase.ARCHITECTURE);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.canTransition).toBe(false);
				expect(result.value.blockingClaims).toBeDefined();
			}
		});

		it('allows transition when gates resolved despite critical claims', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			createClaim(id, 'CRITICAL', ClaimStatus.DISPROVED);

			const result = evaluateTransitionGuards(id, Phase.INTAKE, Phase.ARCHITECTURE);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.canTransition).toBe(true);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = evaluateTransitionGuards('test-id', Phase.INTAKE, Phase.ARCHITECTURE);
			expect(result.success).toBe(false);
		});
	});

	describe('transitionWorkflow', () => {
		it('transitions workflow and records audit trail', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03';
			insertDialogue(id);
			initializeWorkflowState(id);
			const result = transitionWorkflow(
				id,
				Phase.ARCHITECTURE,
				TransitionTrigger.INTAKE_PLAN_APPROVED
			);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.current_phase).toBe(Phase.ARCHITECTURE);
				expect(result.value.previous_phase).toBe(Phase.INTAKE);
			}
		});

		it('stores transition metadata', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = transitionWorkflow(
				id,
				Phase.ARCHITECTURE,
				TransitionTrigger.INTAKE_PLAN_APPROVED,
				{ notes: 'Test transition' }
			);
			expect(result.success).toBe(true);
		});

		it('allows manual override despite blocking conditions', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			createGate(id, GateStatus.OPEN);

			const result = transitionWorkflow(
				id,
				Phase.ARCHITECTURE,
				TransitionTrigger.MANUAL_OVERRIDE
			);
			expect(result.success).toBe(true);
		});

		it('blocks invalid transition', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = transitionWorkflow(
				id,
				Phase.EXECUTE,
				TransitionTrigger.PHASE_COMPLETE
			);
			expect(result.success).toBe(false);
		});

		it('blocks transition with open gates', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			createGate(id, GateStatus.OPEN);

			const result = transitionWorkflow(
				id,
				Phase.ARCHITECTURE,
				TransitionTrigger.INTAKE_PLAN_APPROVED
			);
			expect(result.success).toBe(false);
		});

		it('handles nonexistent dialogue', () => {
			const result = transitionWorkflow(
				'nonexistent',
				Phase.ARCHITECTURE,
				TransitionTrigger.PHASE_COMPLETE
			);
			expect(result.success).toBe(false);
		});
	});

	describe('updateWorkflowMetadata', () => {
		it('updates metadata without changing phase', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = updateWorkflowMetadata(id, { turnCount: 10 });
			expect(result.success).toBe(true);
			if (result.success) {
				const metadata = JSON.parse(result.value.metadata);
				expect(metadata.turnCount).toBe(10);
				expect(result.value.current_phase).toBe(Phase.INTAKE);
			}
		});

		it('merges with existing metadata', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id, { turnCount: 5 });
			updateWorkflowMetadata(id, { claimCount: 3 });

			const result = getWorkflowState(id);
			if (result.success) {
				const metadata = JSON.parse(result.value.metadata);
				expect(metadata.turnCount).toBe(5);
				expect(metadata.claimCount).toBe(3);
			}
		});

		it('clears metadata fields set to undefined', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id, { turnCount: 5, claimCount: 3 });
			updateWorkflowMetadata(id, { turnCount: undefined });

			const result = getWorkflowState(id);
			if (result.success) {
				const metadata = JSON.parse(result.value.metadata);
				expect(metadata.turnCount).toBeUndefined();
				expect(metadata.claimCount).toBe(3);
			}
		});

		it('handles nonexistent dialogue', () => {
			const result = updateWorkflowMetadata('nonexistent', { turnCount: 10 });
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = updateWorkflowMetadata('test-id', { turnCount: 10 });
			expect(result.success).toBe(false);
		});
	});

	describe('getTransitionHistory', () => {
		it('retrieves transition history', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			transitionWorkflow(id, Phase.ARCHITECTURE, TransitionTrigger.INTAKE_PLAN_APPROVED);
			transitionWorkflow(id, Phase.PROPOSE, TransitionTrigger.ARCHITECTURE_APPROVED);

			const result = getTransitionHistory(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
				expect(result.value[0].from_phase).toBe(Phase.INTAKE);
				expect(result.value[0].to_phase).toBe(Phase.ARCHITECTURE);
				expect(result.value[1].from_phase).toBe(Phase.ARCHITECTURE);
				expect(result.value[1].to_phase).toBe(Phase.PROPOSE);
			}
		});

		it('returns empty array for new workflow', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = getTransitionHistory(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles nonexistent dialogue', () => {
			const result = getTransitionHistory('nonexistent');
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getTransitionHistory('test-id');
			expect(result.success).toBe(false);
		});
	});

	describe('reconcileStaleTransitionGraphs', () => {
		it('returns zero when no stale graphs', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = reconcileStaleTransitionGraphs();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(0);
			}
		});

		it('upgrades stale graph version', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const db = getDatabase()!;
			db.prepare(
				'UPDATE workflow_states SET transition_graph_version = ? WHERE dialogue_id = ?'
			).run(0, id);

			const result = reconcileStaleTransitionGraphs();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(1);
			}

			const state = getWorkflowState(id);
			if (state.success) {
				const row = db.prepare(
					'SELECT transition_graph_version FROM workflow_states WHERE dialogue_id = ?'
				).get(id) as { transition_graph_version: number };
				expect(row.transition_graph_version).toBe(TRANSITION_GRAPH_VERSION);
			}
		});

		it('remaps unknown phase to INTAKE', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const db = getDatabase()!;
			db.prepare(
				'UPDATE workflow_states SET current_phase = ?, transition_graph_version = ? WHERE dialogue_id = ?'
			).run('UNKNOWN_PHASE', 0, id);

			const result = reconcileStaleTransitionGraphs();
			expect(result.success).toBe(true);

			const state = getWorkflowState(id);
			if (state.success) {
				expect(state.value.current_phase).toBe(Phase.INTAKE);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = reconcileStaleTransitionGraphs();
			expect(result.success).toBe(false);
		});
	});

	describe('restoreWorkflowState', () => {
		it('restores workflow state', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = restoreWorkflowState(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(id);
			}
		});

		it('handles nonexistent dialogue', () => {
			const result = restoreWorkflowState('nonexistent');
			expect(result.success).toBe(false);
		});
	});

	describe('visualizeWorkflowState', () => {
		it('generates visualization string', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id, { turnCount: 5 });
			transitionWorkflow(id, Phase.ARCHITECTURE, TransitionTrigger.INTAKE_PLAN_APPROVED);

			const result = visualizeWorkflowState(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Workflow State');
				expect(result.value).toContain(id);
				expect(result.value).toContain(Phase.ARCHITECTURE);
				expect(result.value).toContain('Metadata');
				expect(result.value).toContain('Transition History');
			}
		});

		it('handles dialogue without transitions', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);

			const result = visualizeWorkflowState(id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Workflow State');
			}
		});

		it('handles nonexistent dialogue', () => {
			const result = visualizeWorkflowState('nonexistent');
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = visualizeWorkflowState('test-id');
			expect(result.success).toBe(false);
		});
	});

	describe('integration scenarios', () => {
		it('manages complete workflow lifecycle', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);

			const init = initializeWorkflowState(id, { turnCount: 0 });
			expect(init.success).toBe(true);

			updateWorkflowMetadata(id, { turnCount: 1 });

			const trans1 = transitionWorkflow(id, Phase.ARCHITECTURE, TransitionTrigger.INTAKE_PLAN_APPROVED);
			expect(trans1.success).toBe(true);

			const trans2 = transitionWorkflow(id, Phase.PROPOSE, TransitionTrigger.ARCHITECTURE_APPROVED);
			expect(trans2.success).toBe(true);

			const history = getTransitionHistory(id);
			expect(history.success && history.value.length).toBe(2);

			const viz = visualizeWorkflowState(id);
			expect(viz.success).toBe(true);
		});

		it('enforces guard conditions across transitions', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id);
			createGate(id, GateStatus.OPEN);

			const blocked = transitionWorkflow(id, Phase.ARCHITECTURE, TransitionTrigger.INTAKE_PLAN_APPROVED);
			expect(blocked.success).toBe(false);

			const override = transitionWorkflow(id, Phase.ARCHITECTURE, TransitionTrigger.MANUAL_OVERRIDE);
			expect(override.success).toBe(true);
		});

		it('handles metadata updates across transitions', () => {
			const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
			insertDialogue(id);
			initializeWorkflowState(id, { turnCount: 0 });

			updateWorkflowMetadata(id, { turnCount: 5 });
			transitionWorkflow(id, Phase.ARCHITECTURE, TransitionTrigger.INTAKE_PLAN_APPROVED);
			updateWorkflowMetadata(id, { claimCount: 3 });

			const state = getWorkflowState(id);
			if (state.success) {
				const metadata = JSON.parse(state.value.metadata);
				expect(metadata.turnCount).toBe(5);
				expect(metadata.claimCount).toBe(3);
			}
		});
	});
});
