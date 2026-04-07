import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	recordOutcomeSnapshot,
	extractUsefulInvariants,
} from '../../../lib/workflow/outcomeTracker';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/database/init';
import { TaskCategory } from '../../../lib/types/maker';

describe('OutcomeTracker', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;
	let graphId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		graphId = randomUUID();

		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(dialogueId);

		db.prepare(
			`INSERT INTO task_graphs (graph_id, dialogue_id, graph_status, created_at, updated_at)
			 VALUES (?, ?, 'IN_PROGRESS', datetime('now'), datetime('now'))`
		).run(graphId, dialogueId);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('recordOutcomeSnapshot', () => {
		it('records outcome snapshot for completed dialogue', () => {
			const db = getDatabase()!;
			db.prepare(
				`UPDATE task_graphs SET graph_status = 'COMPLETED' WHERE graph_id = ?`
			).run(graphId);

			const unitId = randomUUID();
			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Test Unit', 'Complete task', ?, 'COMPLETED', 0, datetime('now'), datetime('now'))`
			).run(unitId, graphId, TaskCategory.IMPLEMENTATION);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(dialogueId);
				expect(result.value.graph_id).toBe(graphId);
				expect(result.value.success).toBe(true);
				expect(result.value.units_completed).toBe(1);
				expect(result.value.units_total).toBe(1);
			}
		});

		it('records failure for failed graph', () => {
			const db = getDatabase()!;
			db.prepare(
				`UPDATE task_graphs SET graph_status = 'FAILED' WHERE graph_id = ?`
			).run(graphId);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.success).toBe(false);
			}
		});

		it('captures failure modes from failed units', () => {
			const db = getDatabase()!;
			const unitId = randomUUID();
			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Failed Unit', 'Task that failed', ?, 'FAILED', 0, datetime('now'), datetime('now'))`
			).run(unitId, graphId, TaskCategory.IMPLEMENTATION);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.failure_modes.length).toBeGreaterThan(0);
				expect(result.value.failure_modes[0]).toContain('Failed Unit');
			}
		});

		it('calculates wall clock time when start time provided', () => {
			const startTime = Date.now() - 5000; // 5 seconds ago
			const result = recordOutcomeSnapshot(dialogueId, startTime);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total_wall_clock_ms).toBeGreaterThan(0);
				expect(result.value.total_wall_clock_ms).toBeLessThanOrEqual(6000);
			}
		});

		it('sets wall clock time to zero when no start time', () => {
			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total_wall_clock_ms).toBe(0);
			}
		});

		it('includes useful invariants from repairs', () => {
			const db = getDatabase()!;
			const unitId = randomUUID();
			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Test Unit', 'Complete task', ?, 'COMPLETED', 0, datetime('now'), datetime('now'))`
			).run(unitId, graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO repair_packets (repair_id, unit_id, suspected_cause, repair_strategy, result, created_at)
				 VALUES (?, ?, 'Type error', 'Add type annotation', 'FIXED', datetime('now'))`
			).run(randomUUID(), unitId);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.useful_invariants.length).toBeGreaterThan(0);
				const hasRepairPattern = result.value.useful_invariants.some(
					inv => inv.includes('Type error') && inv.includes('Add type annotation')
				);
				expect(hasRepairPattern).toBe(true);
			}
		});

		it('tracks progress correctly', () => {
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 1', 'Task 1', ?, 'COMPLETED', 0, datetime('now'), datetime('now'))`
			).run(randomUUID(), graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 2', 'Task 2', ?, 'IN_PROGRESS', 1, datetime('now'), datetime('now'))`
			).run(randomUUID(), graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 3', 'Task 3', ?, 'PENDING', 2, datetime('now'), datetime('now'))`
			).run(randomUUID(), graphId, TaskCategory.IMPLEMENTATION);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.units_completed).toBe(1);
				expect(result.value.units_total).toBe(3);
			}
		});

		it('returns error when no task graph exists', () => {
			const nonExistentDialogueId = randomUUID();
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test', 'ACTIVE', datetime('now'))"
			).run(nonExistentDialogueId);

			const result = recordOutcomeSnapshot(nonExistentDialogueId);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('No task graph found');
			}
		});

		it('handles database errors gracefully', () => {
			tempDb.cleanup();
			const result = recordOutcomeSnapshot(dialogueId);
			expect(result.success).toBe(false);
		});

		it('initializes empty arrays for providers and augmentations', () => {
			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.providers_used).toEqual([]);
				expect(result.value.augmentations_used).toEqual([]);
			}
		});

		it('generates snapshot_id', () => {
			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.snapshot_id).toBeDefined();
				expect(typeof result.value.snapshot_id).toBe('string');
			}
		});
	});

	describe('extractUsefulInvariants', () => {
		it('extracts patterns from successful repairs', () => {
			const units: any[] = [];
			const repairs: any[] = [
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: 'Missing import',
					repair_strategy: 'Add import statement',
					result: 'FIXED',
					created_at: new Date().toISOString(),
				},
			];

			const invariants = extractUsefulInvariants(units, repairs);

			expect(invariants.length).toBeGreaterThan(0);
			expect(invariants[0]).toContain('Missing import');
			expect(invariants[0]).toContain('Add import statement');
		});

		it('calculates first-try success rate', () => {
			const unit1Id = randomUUID();
			const unit2Id = randomUUID();
			const units: any[] = [
				{ unit_id: unit1Id, status: 'COMPLETED', label: 'Unit 1', goal: 'Task 1' },
				{ unit_id: unit2Id, status: 'COMPLETED', label: 'Unit 2', goal: 'Task 2' },
			];
			const repairs: any[] = [
				{
					repair_id: randomUUID(),
					unit_id: unit2Id,
					suspected_cause: 'Bug',
					repair_strategy: 'Fix',
					result: 'FIXED',
					created_at: new Date().toISOString(),
				},
			];

			const invariants = extractUsefulInvariants(units, repairs);

			const successRateInvariant = invariants.find(inv => inv.includes('First-try success rate'));
			expect(successRateInvariant).toBeDefined();
			expect(successRateInvariant).toContain('50%');
			expect(successRateInvariant).toContain('1/2');
		});

		it('identifies patterns requiring human judgment', () => {
			const units: any[] = [];
			const repairs: any[] = [
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: 'Architecture redesign needed',
					repair_strategy: 'Escalate',
					result: 'ESCALATED',
					created_at: new Date().toISOString(),
				},
			];

			const invariants = extractUsefulInvariants(units, repairs);

			const escalationInvariant = invariants.find(inv => inv.includes('should not attempt'));
			expect(escalationInvariant).toBeDefined();
			expect(escalationInvariant).toContain('Architecture redesign needed');
			expect(escalationInvariant).toContain('human judgment');
		});

		it('returns empty array when no patterns found', () => {
			const units: any[] = [];
			const repairs: any[] = [];

			const invariants = extractUsefulInvariants(units, repairs);

			expect(invariants).toEqual([]);
		});

		it('handles repairs without cause or strategy', () => {
			const units: any[] = [];
			const repairs: any[] = [
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: null,
					repair_strategy: null,
					result: 'FIXED',
					created_at: new Date().toISOString(),
				},
			];

			const invariants = extractUsefulInvariants(units, repairs);

			expect(Array.isArray(invariants)).toBe(true);
		});

		it('extracts multiple repair patterns', () => {
			const units: any[] = [];
			const repairs: any[] = [
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: 'Type error',
					repair_strategy: 'Add type annotation',
					result: 'FIXED',
					created_at: new Date().toISOString(),
				},
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: 'Missing dependency',
					repair_strategy: 'Install package',
					result: 'FIXED',
					created_at: new Date().toISOString(),
				},
			];

			const invariants = extractUsefulInvariants(units, repairs);

			expect(invariants.length).toBeGreaterThanOrEqual(2);
			expect(invariants.some(inv => inv.includes('Type error'))).toBe(true);
			expect(invariants.some(inv => inv.includes('Missing dependency'))).toBe(true);
		});

		it('filters out non-fixed repairs from success patterns', () => {
			const units: any[] = [];
			const repairs: any[] = [
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: 'Problem A',
					repair_strategy: 'Strategy A',
					result: 'FAILED',
					created_at: new Date().toISOString(),
				},
				{
					repair_id: randomUUID(),
					unit_id: randomUUID(),
					suspected_cause: 'Problem B',
					repair_strategy: 'Strategy B',
					result: 'FIXED',
					created_at: new Date().toISOString(),
				},
			];

			const invariants = extractUsefulInvariants(units, repairs);

			expect(invariants.some(inv => inv.includes('Problem A'))).toBe(false);
			expect(invariants.some(inv => inv.includes('Problem B'))).toBe(true);
		});

		it('calculates 100% success rate when all units succeed without repairs', () => {
			const units: any[] = [
				{ unit_id: randomUUID(), status: 'COMPLETED', label: 'Unit 1', goal: 'Task 1' },
				{ unit_id: randomUUID(), status: 'COMPLETED', label: 'Unit 2', goal: 'Task 2' },
			];
			const repairs: any[] = [];

			const invariants = extractUsefulInvariants(units, repairs);

			const successRateInvariant = invariants.find(inv => inv.includes('First-try success rate'));
			expect(successRateInvariant).toBeDefined();
			expect(successRateInvariant).toContain('100%');
		});

		it('excludes failed units from success rate calculation', () => {
			const units: any[] = [
				{ unit_id: randomUUID(), status: 'COMPLETED', label: 'Unit 1', goal: 'Task 1' },
				{ unit_id: randomUUID(), status: 'FAILED', label: 'Unit 2', goal: 'Task 2' },
			];
			const repairs: any[] = [];

			const invariants = extractUsefulInvariants(units, repairs);

			const successRateInvariant = invariants.find(inv => inv.includes('First-try success rate'));
			expect(successRateInvariant).toBeDefined();
			expect(successRateInvariant).toContain('1/2');
		});
	});

	describe('integration scenarios', () => {
		it('records complete workflow with repairs', () => {
			const db = getDatabase()!;
			const unit1Id = randomUUID();
			const unit2Id = randomUUID();

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 1', 'First task', ?, 'COMPLETED', 0, datetime('now'), datetime('now'))`
			).run(unit1Id, graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 2', 'Second task', ?, 'COMPLETED', 1, datetime('now'), datetime('now'))`
			).run(unit2Id, graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO repair_packets (repair_id, unit_id, suspected_cause, repair_strategy, result, created_at)
				 VALUES (?, ?, 'Syntax error', 'Fix syntax', 'FIXED', datetime('now'))`
			).run(randomUUID(), unit2Id);

			db.prepare(
				`UPDATE task_graphs SET graph_status = 'COMPLETED' WHERE graph_id = ?`
			).run(graphId);

			const startTime = Date.now() - 10000;
			const result = recordOutcomeSnapshot(dialogueId, startTime);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.success).toBe(true);
				expect(result.value.units_completed).toBe(2);
				expect(result.value.units_total).toBe(2);
				expect(result.value.useful_invariants.length).toBeGreaterThan(0);
				expect(result.value.total_wall_clock_ms).toBeGreaterThan(0);
			}
		});

		it('records partial completion scenario', () => {
			const db = getDatabase()!;

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 1', 'Task 1', ?, 'COMPLETED', 0, datetime('now'), datetime('now'))`
			).run(randomUUID(), graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 2', 'Task 2', ?, 'FAILED', 1, datetime('now'), datetime('now'))`
			).run(randomUUID(), graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 3', 'Task 3', ?, 'PENDING', 2, datetime('now'), datetime('now'))`
			).run(randomUUID(), graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`UPDATE task_graphs SET graph_status = 'FAILED' WHERE graph_id = ?`
			).run(graphId);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.success).toBe(false);
				expect(result.value.units_completed).toBe(1);
				expect(result.value.units_total).toBe(3);
				expect(result.value.failure_modes.length).toBeGreaterThan(0);
			}
		});

		it('extracts comprehensive invariants from mixed execution', () => {
			const db = getDatabase()!;
			const unit1Id = randomUUID();
			const unit2Id = randomUUID();
			const unit3Id = randomUUID();

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 1', 'Task 1', ?, 'COMPLETED', 0, datetime('now'), datetime('now'))`
			).run(unit1Id, graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 2', 'Task 2', ?, 'COMPLETED', 1, datetime('now'), datetime('now'))`
			).run(unit2Id, graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO task_units (unit_id, graph_id, label, goal, category, status, sort_order, created_at, updated_at)
				 VALUES (?, ?, 'Unit 3', 'Task 3', ?, 'COMPLETED', 2, datetime('now'), datetime('now'))`
			).run(unit3Id, graphId, TaskCategory.IMPLEMENTATION);

			db.prepare(
				`INSERT INTO repair_packets (repair_id, unit_id, suspected_cause, repair_strategy, result, created_at)
				 VALUES (?, ?, 'Import error', 'Add import', 'FIXED', datetime('now'))`
			).run(randomUUID(), unit2Id);

			db.prepare(
				`INSERT INTO repair_packets (repair_id, unit_id, suspected_cause, repair_strategy, result, created_at)
				 VALUES (?, ?, 'Complex refactor', 'Escalate to human', 'ESCALATED', datetime('now'))`
			).run(randomUUID(), unit3Id);

			const result = recordOutcomeSnapshot(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				const invariants = result.value.useful_invariants;
				expect(invariants.some(inv => inv.includes('Import error'))).toBe(true);
				expect(invariants.some(inv => inv.includes('Complex refactor'))).toBe(true);
				expect(invariants.some(inv => inv.includes('First-try success rate'))).toBe(true);
			}
		});
	});
});
