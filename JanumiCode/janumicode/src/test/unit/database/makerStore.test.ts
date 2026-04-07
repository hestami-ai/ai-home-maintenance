import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	createIntentRecord,
	getIntentRecord,
	getIntentRecordForDialogue,
	updateIntentRecord,
	createAcceptanceContract,
	getAcceptanceContract,
	getAcceptanceContractForDialogue,
	createTaskGraph,
	getTaskGraph,
	updateTaskGraphStatus,
	createTaskUnit,
	bulkCreateTaskUnits,
	getTaskUnitsForGraph,
	getReadyUnits,
	updateTaskUnitStatus,
	createTaskEdge,
	getEdgesForGraph,
	getDependenciesForUnit,
	createClaimUnit,
	getClaimUnitsForUnit,
	createEvidencePacket,
	getEvidencePacketsForUnit,
	createValidationPacket,
	getLatestValidationForUnit,
	createRepairPacket,
	getRepairAttemptCount,
	createHistoricalInvariantPacket,
	getHistoricalInvariantPacketsForDialogue,
	createOutcomeSnapshot,
	getOutcomeSnapshotsForDialogue,
	upsertToolchainDetection,
	getToolchainDetectionsForWorkspace,
} from '../../../lib/database/makerStore';
import { getDatabase } from '../../../lib/database/init';
import {
	RiskPosture,
	TaskGraphStatus,
	TaskCategory,
	TaskUnitStatus,
	EdgeType,
	ClaimScope,
	ValidationType,
	FailureType,
	RepairClassification,
	RepairResult,
} from '../../../lib/types/maker';

describe('MakerStore', () => {
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

	describe('Intent Records', () => {
		it('creates intent record with defaults', () => {
			const result = createIntentRecord(DLG_ID, 'Build a web app');
			
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(DLG_ID);
				expect(result.value.human_goal).toBe('Build a web app');
				expect(result.value.intent_id).toHaveLength(36);
				expect(result.value.scope_in).toEqual([]);
				expect(result.value.scope_out).toEqual([]);
				expect(result.value.risk_posture).toBe('BALANCED');
			}
		});

		it('creates intent record with custom options', () => {
			const result = createIntentRecord(DLG_ID, 'Build API', {
				scope_in: ['authentication', 'user management'],
				scope_out: ['billing'],
				priority_axes: ['security', 'performance'],
				risk_posture: RiskPosture.CONSERVATIVE,
				clarifications_resolved: [{ question: 'q1', answer: 'a1', resolved_at: new Date().toISOString() }],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.scope_in).toEqual(['authentication', 'user management']);
				expect(result.value.risk_posture).toBe('CONSERVATIVE');
				expect(result.value.clarifications_resolved).toHaveLength(1);
			}
		});

		it('retrieves intent record by id', () => {
			const created = createIntentRecord(DLG_ID, 'Test goal');
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const retrieved = getIntentRecord(created.value.intent_id);
			expect(retrieved.success).toBe(true);
			if (retrieved.success) {
				expect(retrieved.value.intent_id).toBe(created.value.intent_id);
				expect(retrieved.value.human_goal).toBe('Test goal');
			}
		});

		it('returns error for non-existent intent id', () => {
			const result = getIntentRecord('non-existent');
			expect(result.success).toBe(false);
		});

		it('retrieves latest intent for dialogue', () => {
			createIntentRecord(DLG_ID, 'First goal');
			createIntentRecord(DLG_ID, 'Second goal');

			const result = getIntentRecordForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.human_goal).toBe('Second goal');
			}
		});

		it('updates intent record', () => {
			const created = createIntentRecord(DLG_ID, 'Original');
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const updated = updateIntentRecord(created.value.intent_id, {
				human_goal: 'Updated goal',
				scope_in: ['new scope'],
			});

			expect(updated.success).toBe(true);
			if (updated.success) {
				expect(updated.value.human_goal).toBe('Updated goal');
				expect(updated.value.scope_in).toEqual(['new scope']);
				// updated_at must not go backwards (string comparison is safe for ISO-8601).
				// We do NOT assert strict inequality: create+update can land in the same ms,
				// which is an implementation accident with no observable consequence.
				expect(updated.value.updated_at >= created.value.updated_at).toBe(true);
			}
		});
	});

	describe('Acceptance Contracts', () => {
		it('creates acceptance contract', () => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			expect(intent.success).toBe(true);
			if (!intent.success) { return; }

			const result = createAcceptanceContract(intent.value.intent_id, DLG_ID, {
				success_conditions: ['All tests pass', 'No runtime errors'],
				required_validations: [
					{ type: ValidationType.UNIT_TEST, description: 'coverage > 80%' },
				],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.intent_id).toBe(intent.value.intent_id);
				expect(result.value.success_conditions).toHaveLength(2);
				expect(result.value.required_validations).toHaveLength(1);
			}
		});

		it('retrieves acceptance contract by id', () => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }

			const created = createAcceptanceContract(intent.value.intent_id, DLG_ID);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const retrieved = getAcceptanceContract(created.value.contract_id);
			expect(retrieved.success).toBe(true);
			if (retrieved.success) {
				expect(retrieved.value.contract_id).toBe(created.value.contract_id);
			}
		});

		it('retrieves latest contract for dialogue', () => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }

			createAcceptanceContract(intent.value.intent_id, DLG_ID);
			const contract2 = createAcceptanceContract(intent.value.intent_id, DLG_ID, {
				success_conditions: ['Latest condition'],
			});
			expect(contract2.success).toBe(true);

			const result = getAcceptanceContractForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.success_conditions).toContain('Latest condition');
			}
		});
	});

	describe('Task Graphs', () => {
		it('creates task graph', () => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }

			const result = createTaskGraph(DLG_ID, intent.value.intent_id, 'Build feature X');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(DLG_ID);
				expect(result.value.intent_id).toBe(intent.value.intent_id);
				expect(result.value.root_goal).toBe('Build feature X');
				expect(result.value.graph_status).toBe('DRAFT');
			}
		});

		it('retrieves task graph by id', () => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }

			const created = createTaskGraph(DLG_ID, intent.value.intent_id, 'Root goal');
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const retrieved = getTaskGraph(created.value.graph_id);
			expect(retrieved.success).toBe(true);
			if (retrieved.success) {
				expect(retrieved.value.graph_id).toBe(created.value.graph_id);
			}
		});

		it('updates task graph status', () => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }

			const created = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!created.success) { return; }

			const updated = updateTaskGraphStatus(created.value.graph_id, TaskGraphStatus.IN_PROGRESS);
			expect(updated.success).toBe(true);
			if (updated.success) {
				expect(updated.value.graph_status).toBe(TaskGraphStatus.IN_PROGRESS);
			}
		});
	});

	describe('Task Units', () => {
		let graphId: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			graphId = graph.value.graph_id;
		});

		it('creates task unit', () => {
			const result = createTaskUnit(graphId, {
				label: 'Implement login',
				goal: 'Add user authentication',
				category: TaskCategory.IMPLEMENTATION,
				inputs: ['user credentials'],
				outputs: ['auth token'],
				preconditions: ['database ready'],
				postconditions: ['user authenticated'],
				allowed_tools: ['code_editor', 'terminal'],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: ['test passes'],
				falsifiers: ['test fails'],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.label).toBe('Implement login');
				expect(result.value.status).toBe('PENDING');
				expect(result.value.inputs).toContain('user credentials');
			}
		});

		it('bulk creates task units', () => {
			const units = [
				{
					label: 'Unit 1',
					goal: 'Goal 1',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					preferred_provider: null,
					max_change_scope: 'file',
					observables: [],
					falsifiers: [],
					verification_method: 'manual',
					status: TaskUnitStatus.PENDING,
					parent_unit_id: null,
					sort_order: 1,
				},
				{
					label: 'Unit 2',
					goal: 'Goal 2',
					category: TaskCategory.TEST,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					preferred_provider: null,
					max_change_scope: 'file',
					observables: [],
					falsifiers: [],
					verification_method: 'automated',
					status: TaskUnitStatus.PENDING,
					parent_unit_id: null,
					sort_order: 2,
				},
			];

			const result = bulkCreateTaskUnits(graphId, units);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].label).toBe('Unit 1');
				expect(result.value[1].label).toBe('Unit 2');
			}
		});

		it('retrieves task units for graph ordered by sort_order', () => {
			createTaskUnit(graphId, {
				label: 'Second',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 2,
			});

			createTaskUnit(graphId, {
				label: 'First',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});

			const result = getTaskUnitsForGraph(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].label).toBe('First');
				expect(result.value[1].label).toBe('Second');
			}
		});

		it('retrieves ready units', () => {
			const unit1 = createTaskUnit(graphId, {
				label: 'Pending',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!unit1.success) { return; }

			const unit2 = createTaskUnit(graphId, {
				label: 'Ready',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.READY,
				parent_unit_id: null,
				sort_order: 2,
			});
			expect(unit2.success).toBe(true);

			const result = getReadyUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].label).toBe('Ready');
			}
		});

		it('updates task unit status', () => {
			const created = createTaskUnit(graphId, {
				label: 'Test',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!created.success) { return; }

			const updated = updateTaskUnitStatus(created.value.unit_id, TaskUnitStatus.IN_PROGRESS);
			expect(updated.success).toBe(true);
			if (updated.success) {
				expect(updated.value.status).toBe(TaskUnitStatus.IN_PROGRESS);
			}
		});
	});

	describe('Task Edges', () => {
		let graphId: string;
		let unit1Id: string;
		let unit2Id: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			graphId = graph.value.graph_id;

			const u1 = createTaskUnit(graphId, {
				label: 'Unit 1',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!u1.success) { return; }
			unit1Id = u1.value.unit_id;

			const u2 = createTaskUnit(graphId, {
				label: 'Unit 2',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 2,
			});
			if (!u2.success) { return; }
			unit2Id = u2.value.unit_id;
		});

		it('creates task edge', () => {
			const result = createTaskEdge(graphId, unit1Id, unit2Id, EdgeType.DEPENDS_ON);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.from_unit_id).toBe(unit1Id);
				expect(result.value.to_unit_id).toBe(unit2Id);
				expect(result.value.edge_type).toBe(EdgeType.DEPENDS_ON);
			}
		});

		it('retrieves edges for graph', () => {
			createTaskEdge(graphId, unit1Id, unit2Id, EdgeType.DEPENDS_ON);
			createTaskEdge(graphId, unit2Id, unit1Id, EdgeType.RELATED);

			const result = getEdgesForGraph(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});

		it('retrieves dependencies for unit', () => {
			createTaskEdge(graphId, unit1Id, unit2Id, EdgeType.DEPENDS_ON);
			createTaskEdge(graphId, unit1Id, unit2Id, EdgeType.RELATED);

			const result = getDependenciesForUnit(unit2Id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].edge_type).toBe(EdgeType.DEPENDS_ON);
			}
		});
	});

	describe('Claim Units', () => {
		let unitId: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			const unit = createTaskUnit(graph.value.graph_id, {
				label: 'Test Unit',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!unit.success) { return; }
			unitId = unit.value.unit_id;
		});

		it('creates claim unit', () => {
			const result = createClaimUnit(
				unitId,
				'Function returns correct output',
				ClaimScope.ATOMIC,
				['wrong output type', 'null returned'],
				['unit test output']
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.statement).toBe('Function returns correct output');
				expect(result.value.claim_scope).toBe(ClaimScope.ATOMIC);
				expect(result.value.falsifiers).toHaveLength(2);
			}
		});

		it('retrieves claim units for unit', () => {
			createClaimUnit(unitId, 'Claim 1', ClaimScope.ATOMIC, [], []);
			createClaimUnit(unitId, 'Claim 2', ClaimScope.COMPOSITE, [], []);

			const result = getClaimUnitsForUnit(unitId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});
	});

	describe('Evidence Packets', () => {
		let unitId: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			const unit = createTaskUnit(graph.value.graph_id, {
				label: 'Test Unit',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!unit.success) { return; }
			unitId = unit.value.unit_id;
		});

		it('creates evidence packet', () => {
			const result = createEvidencePacket(unitId, {
				sources: ['test output', 'log file'],
				supported_statements: ['claim 1'],
				unsupported_statements: ['claim 2'],
				confidence: 0.85,
				gaps: ['missing integration test'],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.confidence).toBe(0.85);
				expect(result.value.sources).toHaveLength(2);
			}
		});

		it('retrieves evidence packets for unit ordered chronologically', () => {
			createEvidencePacket(unitId, { confidence: 0.5 });
			createEvidencePacket(unitId, { confidence: 0.9 });

			const result = getEvidencePacketsForUnit(unitId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].confidence).toBe(0.5);
				expect(result.value[1].confidence).toBe(0.9);
			}
		});
	});

	describe('Validation Packets', () => {
		let unitId: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			const unit = createTaskUnit(graph.value.graph_id, {
				label: 'Test Unit',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!unit.success) { return; }
			unitId = unit.value.unit_id;
		});

		it('creates validation packet with PASS', () => {
			const result = createValidationPacket(unitId, {
				checks: [{ check_type: ValidationType.UNIT_TEST, command: 'npm test', exit_code: 0, stdout_excerpt: 'All tests passed', passed: true }],
				expected_observables: ['test passes'],
				actual_observables: ['test passes'],
				pass_fail: 'PASS',
				failure_type: null,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.pass_fail).toBe('PASS');
				expect(result.value.failure_type).toBeNull();
			}
		});

		it('creates validation packet with FAIL', () => {
			const result = createValidationPacket(unitId, {
				checks: [{ check_type: ValidationType.LINT, command: 'npm run lint', exit_code: 1, stdout_excerpt: 'Linting errors', passed: false }],
				expected_observables: ['no lint errors'],
				actual_observables: ['3 lint errors'],
				pass_fail: 'FAIL',
				failure_type: FailureType.LINT_ERROR,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.pass_fail).toBe('FAIL');
				expect(result.value.failure_type).toBe(FailureType.LINT_ERROR);
			}
		});

		it('retrieves latest validation for unit', () => {
			createValidationPacket(unitId, {
				checks: [],
				expected_observables: [],
				actual_observables: [],
				pass_fail: 'FAIL',
				failure_type: FailureType.RUNTIME_ERROR,
			});

			createValidationPacket(unitId, {
				checks: [],
				expected_observables: [],
				actual_observables: [],
				pass_fail: 'PASS',
				failure_type: null,
			});

			const result = getLatestValidationForUnit(unitId);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.pass_fail).toBe('PASS');
			}
		});

		it('returns null when no validation exists', () => {
			const result = getLatestValidationForUnit(unitId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('Repair Packets', () => {
		let unitId: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			const unit = createTaskUnit(graph.value.graph_id, {
				label: 'Test Unit',
				goal: 'Test',
				category: TaskCategory.IMPLEMENTATION,
				inputs: [],
				outputs: [],
				preconditions: [],
				postconditions: [],
				allowed_tools: [],
				preferred_provider: null,
				max_change_scope: 'file',
				observables: [],
				falsifiers: [],
				verification_method: 'automated',
				status: TaskUnitStatus.PENDING,
				parent_unit_id: null,
				sort_order: 1,
			});
			if (!unit.success) { return; }
			unitId = unit.value.unit_id;
		});

		it('creates repair packet', () => {
			const result = createRepairPacket(unitId, {
				suspected_cause: 'Missing import statement',
				repair_strategy: 'Add import at top of file',
				attempt_count: 1,
				max_attempts: 3,
				escalation_threshold: RepairClassification.AUTO_REPAIR_SAFE,
				diff_before: 'old code',
				diff_after: 'new code',
				result: RepairResult.FIXED,
				wall_clock_ms: 1500,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.result).toBe(RepairResult.FIXED);
				expect(result.value.attempt_count).toBe(1);
			}
		});

		it('retrieves repair attempt count', () => {
			createRepairPacket(unitId, {
				suspected_cause: 'test',
				repair_strategy: 'test',
				attempt_count: 1,
				max_attempts: 3,
				escalation_threshold: RepairClassification.AUTO_REPAIR_SAFE,
				diff_before: '',
				diff_after: '',
				result: RepairResult.FAILED,
				wall_clock_ms: 100,
			});

			createRepairPacket(unitId, {
				suspected_cause: 'test',
				repair_strategy: 'test',
				attempt_count: 2,
				max_attempts: 3,
				escalation_threshold: RepairClassification.AUTO_REPAIR_SAFE,
				diff_before: '',
				diff_after: '',
				result: RepairResult.FIXED,
				wall_clock_ms: 200,
			});

			const result = getRepairAttemptCount(unitId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(2);
			}
		});
	});

	describe('Historical Invariant Packets', () => {
		it('creates historical invariant packet', () => {
			const result = createHistoricalInvariantPacket(DLG_ID, null, {
				relevant_invariants: ['Always validate input'],
				prior_failure_motifs: ['Off-by-one errors'],
				precedent_patterns: ['Factory pattern worked well'],
				reusable_subplans: ['Setup DB connection'],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(DLG_ID);
				expect(result.value.relevant_invariants).toHaveLength(1);
			}
		});

		it('retrieves historical packets for dialogue', () => {
			createHistoricalInvariantPacket(DLG_ID, null, {
				relevant_invariants: ['Invariant 1'],
			});
			createHistoricalInvariantPacket(DLG_ID, null, {
				relevant_invariants: ['Invariant 2'],
			});

			const result = getHistoricalInvariantPacketsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});
	});

	describe('Outcome Snapshots', () => {
		let graphId: string;

		beforeEach(() => {
			const intent = createIntentRecord(DLG_ID, 'Test');
			if (!intent.success) { return; }
			const graph = createTaskGraph(DLG_ID, intent.value.intent_id, 'Test');
			if (!graph.success) { return; }
			graphId = graph.value.graph_id;
		});

		it('creates outcome snapshot', () => {
			const result = createOutcomeSnapshot(DLG_ID, graphId, {
				providers_used: [
					{ provider_id: 'claude', role: 'executor', units_executed: 5, success_rate: 1, avg_duration_ms: 2000 },
				],
				augmentations_used: ['context_pack'],
				success: true,
				failure_modes: [],
				useful_invariants: ['Always validate'],
				units_completed: 3,
				units_total: 5,
				total_wall_clock_ms: 5000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.success).toBe(true);
				expect(result.value.units_completed).toBe(3);
			}
		});

		it('retrieves outcome snapshots for dialogue', () => {
			createOutcomeSnapshot(DLG_ID, graphId, {
				providers_used: [],
				augmentations_used: [],
				success: false,
				failure_modes: ['timeout'],
				useful_invariants: [],
				units_completed: 0,
				units_total: 5,
				total_wall_clock_ms: 1000,
			});

			const result = getOutcomeSnapshotsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].success).toBe(false);
			}
		});
	});

	describe('Toolchain Detections', () => {
		it('upserts toolchain detection', () => {
			const result = upsertToolchainDetection({
				workspace_root: '/path/to/project',
				project_type: 'typescript',
				package_manager: 'pnpm',
				lint_command: 'pnpm lint',
				type_check_command: 'pnpm typecheck',
				test_command: 'pnpm test',
				build_command: 'pnpm build',
				detected_at: new Date().toISOString(),
				confidence: 0.95,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.project_type).toBe('typescript');
				expect(result.value.confidence).toBe(0.95);
			}
		});

		it('replaces existing detection for same workspace+project', () => {
			upsertToolchainDetection({
				workspace_root: '/path/to/project',
				project_type: 'typescript',
				package_manager: 'npm',
				lint_command: null,
				type_check_command: null,
				test_command: null,
				build_command: null,
				detected_at: new Date().toISOString(),
				confidence: 0.5,
			});

			upsertToolchainDetection({
				workspace_root: '/path/to/project',
				project_type: 'typescript',
				package_manager: 'pnpm',
				lint_command: 'pnpm lint',
				type_check_command: null,
				test_command: null,
				build_command: null,
				detected_at: new Date().toISOString(),
				confidence: 0.9,
			});

			const result = getToolchainDetectionsForWorkspace('/path/to/project');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].package_manager).toBe('pnpm');
			}
		});

		it('retrieves detections ordered by confidence', () => {
			upsertToolchainDetection({
				workspace_root: '/workspace',
				project_type: 'python',
				package_manager: 'pip',
				lint_command: null,
				type_check_command: null,
				test_command: null,
				build_command: null,
				detected_at: new Date().toISOString(),
				confidence: 0.5,
			});

			upsertToolchainDetection({
				workspace_root: '/workspace',
				project_type: 'typescript',
				package_manager: 'npm',
				lint_command: null,
				type_check_command: null,
				test_command: null,
				build_command: null,
				detected_at: new Date().toISOString(),
				confidence: 0.9,
			});

			const result = getToolchainDetectionsForWorkspace('/workspace');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].confidence).toBe(0.9);
				expect(result.value[1].confidence).toBe(0.5);
			}
		});
	});
});
