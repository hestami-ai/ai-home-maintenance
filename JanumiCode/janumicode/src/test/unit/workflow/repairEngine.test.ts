import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	classifyRepairability,
	canAttemptRepair,
	buildRepairPrompt,
} from '../../../lib/workflow/repairEngine';
import {
	FailureType,
	RepairClassification,
	RepairResult,
	REPAIR_POLICY,
	TaskCategory,
	TaskUnitStatus,
	ValidationType,
} from '../../../lib/types/maker';
import type { TaskUnit, ValidationPacket, RepairPacket } from '../../../lib/types/maker';
import { randomUUID } from 'node:crypto';

// ─── Fixture builders ────────────────────────────────────────────────

function makeRepairPacket(overrides: Partial<RepairPacket> & Pick<RepairPacket, 'unit_id'>): RepairPacket {
	return {
		repair_id: randomUUID(),
		suspected_cause: 'Test cause',
		repair_strategy: 'Test strategy',
		attempt_count: 1,
		max_attempts: REPAIR_POLICY.max_attempts_per_unit,
		escalation_threshold: RepairClassification.AUTO_REPAIR_SAFE,
		diff_before: '',
		diff_after: '',
		result: RepairResult.FAILED,
		wall_clock_ms: 1000,
		created_at: new Date().toISOString(),
		...overrides,
	};
}

describe('RepairEngine', () => {
	let tempDb: TempDbContext;
	let taskUnit: TaskUnit;
	let validationPacket: ValidationPacket;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();

		taskUnit = {
			unit_id: randomUUID(),
			graph_id: randomUUID(),
			label: 'Test Unit',
			goal: 'Test goal',
			category: TaskCategory.IMPLEMENTATION,
			inputs: [],
			outputs: ['output.ts'],
			preconditions: [],
			postconditions: ['Code compiles'],
			allowed_tools: ['file_write'],
			preferred_provider: null,
			max_change_scope: 'src/test/',
			observables: ['File exists'],
			falsifiers: ['Compilation fails'],
			verification_method: 'tsc --noEmit',
			status: TaskUnitStatus.FAILED,
			parent_unit_id: null,
			sort_order: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		validationPacket = {
			validation_id: randomUUID(),
			unit_id: taskUnit.unit_id,
			failure_type: FailureType.LINT_ERROR,
			checks: [
				{
					check_type: ValidationType.LINT,
					command: 'eslint src/test/',
					exit_code: 1,
					stdout_excerpt: 'Error: Missing semicolon',
					passed: false,
				},
			],
			expected_observables: [],
			actual_observables: [],
			pass_fail: 'FAIL',
			created_at: new Date().toISOString(),
		};
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('classifyRepairability', () => {
		it('classifies safe auto-repair types', () => {
			const classification = classifyRepairability(FailureType.LINT_ERROR, taskUnit, []);
			expect(classification).toBe(RepairClassification.AUTO_REPAIR_SAFE);
		});

		it('classifies format errors as safe', () => {
			const classification = classifyRepairability(FailureType.FORMAT_ERROR, taskUnit, []);
			expect(classification).toBe(RepairClassification.AUTO_REPAIR_SAFE);
		});

		it('escalates on ambiguous behavior', () => {
			const classification = classifyRepairability(FailureType.AMBIGUOUS_BEHAVIOR, taskUnit, []);
			expect(classification).toBe(RepairClassification.ESCALATE_REQUIRED);
		});

		it('escalates on security boundary concerns', () => {
			const classification = classifyRepairability(FailureType.SECURITY_BOUNDARY, taskUnit, []);
			expect(classification).toBe(RepairClassification.ESCALATE_REQUIRED);
		});

		it('escalates on data migration risk', () => {
			const classification = classifyRepairability(FailureType.DATA_MIGRATION_RISK, taskUnit, []);
			expect(classification).toBe(RepairClassification.ESCALATE_REQUIRED);
		});

		it('escalates on repeated failures', () => {
			const existingRepair = makeRepairPacket({ unit_id: taskUnit.unit_id });

			const classification = classifyRepairability(FailureType.LINT_ERROR, taskUnit, [existingRepair]);
			expect(classification).toBe(RepairClassification.ESCALATE_REQUIRED);
		});

		it('classifies runtime errors as conditional', () => {
			const classification = classifyRepairability(FailureType.RUNTIME_ERROR, taskUnit, []);
			expect(classification).toBe(RepairClassification.CONDITIONAL);
		});

		it('classifies import resolution as safe', () => {
			const classification = classifyRepairability(FailureType.IMPORT_RESOLUTION, taskUnit, []);
			expect(classification).toBe(RepairClassification.AUTO_REPAIR_SAFE);
		});

		it('classifies local type errors as safe', () => {
			const classification = classifyRepairability(FailureType.LOCAL_TYPE_ERROR, taskUnit, []);
			expect(classification).toBe(RepairClassification.AUTO_REPAIR_SAFE);
		});
	});

	describe('canAttemptRepair', () => {
		it('allows repair when budget available', () => {
			const result = canAttemptRepair(taskUnit, [], Date.now());
			expect(result.allowed).toBe(true);
		});

		it('blocks repair when max attempts reached', () => {
			const existingRepairs: RepairPacket[] = new Array(REPAIR_POLICY.max_attempts_per_unit)
				.fill(null)
				.map(() => makeRepairPacket({ unit_id: taskUnit.unit_id }));

			const result = canAttemptRepair(taskUnit, existingRepairs, Date.now());
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain('Maximum attempts');
		});

		it('blocks when max auto-repairs reached', () => {
			const existingRepairs: RepairPacket[] = new Array(REPAIR_POLICY.max_auto_repairs_per_unit)
				.fill(null)
				.map(() => makeRepairPacket({ unit_id: taskUnit.unit_id }));

			const result = canAttemptRepair(taskUnit, existingRepairs, Date.now());
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain('auto-repairs');
		});

		it('blocks when wall-clock limit exceeded', () => {
			const startTime = Date.now() - (REPAIR_POLICY.max_minutes_per_unit * 60 * 1000 + 1000);
			const result = canAttemptRepair(taskUnit, [], startTime);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain('Wall-clock limit');
		});

		it('counts only auto-repairs for auto-repair limit', () => {
			const existingRepairs: RepairPacket[] = [
				makeRepairPacket({
					unit_id: taskUnit.unit_id,
					escalation_threshold: RepairClassification.CONDITIONAL,
				}),
			];

			const result = canAttemptRepair(taskUnit, existingRepairs, Date.now());
			expect(result.allowed).toBe(true);
		});
	});

	describe('buildRepairPrompt', () => {
		it('includes unit details', () => {
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Test cause');
			expect(prompt).toContain(taskUnit.label);
			expect(prompt).toContain(taskUnit.goal);
			expect(prompt).toContain(taskUnit.max_change_scope);
		});

		it('includes failure type', () => {
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Test cause');
			expect(prompt).toContain(FailureType.LINT_ERROR);
		});

		it('includes suspected cause', () => {
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Missing semicolon');
			expect(prompt).toContain('Missing semicolon');
		});

		it('includes failed checks', () => {
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Test cause');
			expect(prompt).toContain('eslint');
			expect(prompt).toContain('Exit Code: 1');
		});

		it('includes postconditions', () => {
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Test cause');
			expect(prompt).toContain('Code compiles');
		});

		it('handles empty postconditions', () => {
			taskUnit.postconditions = [];
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Test cause');
			expect(prompt).toContain('(none)');
		});

		it('includes check output excerpts', () => {
			const prompt = buildRepairPrompt(taskUnit, validationPacket, 'Test cause');
			expect(prompt).toContain('Missing semicolon');
		});
	});

	describe('integration scenarios', () => {
		it('manages repair classification workflow', () => {
			const classification = classifyRepairability(FailureType.LINT_ERROR, taskUnit, []);
			expect(classification).toBe(RepairClassification.AUTO_REPAIR_SAFE);

			const budgetCheck = canAttemptRepair(taskUnit, [], Date.now());
			expect(budgetCheck.allowed).toBe(true);
		});

		it('enforces budget constraints across classifications', () => {
			const existingRepairs: RepairPacket[] = new Array(REPAIR_POLICY.max_attempts_per_unit)
				.fill(null)
				.map(() => makeRepairPacket({ unit_id: taskUnit.unit_id }));

			const classification = classifyRepairability(FailureType.FORMAT_ERROR, taskUnit, existingRepairs);
			expect(classification).toBe(RepairClassification.ESCALATE_REQUIRED);

			const budgetCheck = canAttemptRepair(taskUnit, existingRepairs, Date.now());
			expect(budgetCheck.allowed).toBe(false);
		});

		it('handles multiple failure types consistently', () => {
			const safeTypes = [
				FailureType.LINT_ERROR,
				FailureType.FORMAT_ERROR,
				FailureType.IMPORT_RESOLUTION,
				FailureType.LOCAL_TYPE_ERROR,
			];

			for (const failureType of safeTypes) {
				const classification = classifyRepairability(failureType, taskUnit, []);
				expect(classification).toBe(RepairClassification.AUTO_REPAIR_SAFE);
			}
		});

		it('escalates critical failure types', () => {
			const escalateTypes = [
				FailureType.AMBIGUOUS_BEHAVIOR,
				FailureType.SECURITY_BOUNDARY,
				FailureType.DATA_MIGRATION_RISK,
			];

			for (const failureType of escalateTypes) {
				const classification = classifyRepairability(failureType, taskUnit, []);
				expect(classification).toBe(RepairClassification.ESCALATE_REQUIRED);
			}
		});
	});
});
