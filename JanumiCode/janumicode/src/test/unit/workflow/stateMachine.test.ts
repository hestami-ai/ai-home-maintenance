import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	initializeWorkflowState,
	getWorkflowState,
	transitionWorkflow,
	isValidTransition,
	TransitionTrigger,
} from '../../../lib/workflow/stateMachine';
import { Phase } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';

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

	it('validates allowed transitions', () => {
		expect(isValidTransition(Phase.INTAKE, Phase.PROPOSE)).toBe(true);
		expect(isValidTransition(Phase.PROPOSE, Phase.ASSUMPTION_SURFACING)).toBe(true);
		expect(isValidTransition(Phase.ASSUMPTION_SURFACING, Phase.VERIFY)).toBe(true);
		expect(isValidTransition(Phase.VERIFY, Phase.HISTORICAL_CHECK)).toBe(true);
		expect(isValidTransition(Phase.HISTORICAL_CHECK, Phase.REVIEW)).toBe(true);
		expect(isValidTransition(Phase.REVIEW, Phase.EXECUTE)).toBe(true);
		expect(isValidTransition(Phase.EXECUTE, Phase.VALIDATE)).toBe(true);
		expect(isValidTransition(Phase.VALIDATE, Phase.COMMIT)).toBe(true);
		expect(isValidTransition(Phase.COMMIT, Phase.INTAKE)).toBe(true);
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

	it('transitions workflow and records audit trail', () => {
		const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03';
		insertDialogue(id);
		initializeWorkflowState(id);
		const result = transitionWorkflow(
			id,
			Phase.PROPOSE,
			TransitionTrigger.INTAKE_PLAN_APPROVED
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.current_phase).toBe(Phase.PROPOSE);
			expect(result.value.previous_phase).toBe(Phase.INTAKE);
		}
	});

	it('returns error for non-existent dialogue', () => {
		const result = getWorkflowState('nonexistent');
		expect(result.success).toBe(false);
	});
});
