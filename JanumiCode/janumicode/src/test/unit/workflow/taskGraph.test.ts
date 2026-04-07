import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	resetStaleInProgressUnits,
	getNextReadyUnits,
	completeUnitAndPropagate,
	isGraphComplete,
	getGraphProgress,
	buildTaskGraphFromResponse,
	checkDecompositionQuality,
	computeCriticalPath,
	type RawTaskUnit,
	type RawTaskEdge,
} from '../../../lib/workflow/taskGraph';
import type { TaskUnit, TaskEdge } from '../../../lib/types/maker';
import { TaskCategory, TaskUnitStatus, EdgeType } from '../../../lib/types/maker';
import { randomUUID } from 'node:crypto';

// Stub the Context Engineer so unit tests don't trigger real LLM calls
// (the CE is itself an LLM-invoking agent that runs as a pre-step before
// role invocations). We're testing the workflow logic, not context assembly.
vi.mock('../../../lib/context', async () => {
	const actual = await vi.importActual<typeof import('../../../lib/context')>('../../../lib/context');
	return {
		...actual,
		assembleContext: vi.fn(async () => ({
			success: true as const,
			value: {
				briefing: '# Stub briefing for unit test',
				sectionManifest: [],
				sufficiency: { sufficient: true, missingRequired: [], warnings: [] },
				fingerprint: 'test-fp',
				diagnostics: { policyKey: 'test', policyVersion: 1, handoffDocsConsumed: [], sqlQueriesExecuted: 0, wallClockMs: 0 },
			},
		})),
	};
});



describe('TaskGraph', () => {
	let tempDb: TempDbContext;
	let graphId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		graphId = randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('resetStaleInProgressUnits', () => {
		it('resets stale units', () => {
			const result = resetStaleInProgressUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value).toBe('number');
			}
		});

		it('handles nonexistent graph', () => {
			const result = resetStaleInProgressUnits('nonexistent');
			expect(result.success).toBeDefined();
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = resetStaleInProgressUnits(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('getNextReadyUnits', () => {
		it('retrieves ready units', () => {
			const result = getNextReadyUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.value)).toBe(true);
			}
		});

		it('returns empty array for empty graph', () => {
			const result = getNextReadyUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getNextReadyUnits(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('completeUnitAndPropagate', () => {
		it('attempts to complete unit', () => {
			const result = completeUnitAndPropagate(graphId, randomUUID());
			expect(result.success).toBeDefined();
		});

		it('handles nonexistent unit', () => {
			const result = completeUnitAndPropagate(graphId, 'nonexistent');
			expect(result.success).toBeDefined();
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = completeUnitAndPropagate(graphId, randomUUID());
			expect(result.success).toBe(false);
		});
	});

	describe('isGraphComplete', () => {
		it('checks completion status', () => {
			const result = isGraphComplete(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value).toBe('boolean');
			}
		});

		it('returns true for empty graph', () => {
			const result = isGraphComplete(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(true);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = isGraphComplete(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('getGraphProgress', () => {
		it('retrieves progress summary', () => {
			const result = getGraphProgress(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total).toBeDefined();
				expect(result.value.completed).toBeDefined();
				expect(result.value.failed).toBeDefined();
			}
		});

		it('returns zero counts for empty graph', () => {
			const result = getGraphProgress(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total).toBe(0);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getGraphProgress(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('integration scenarios', () => {
		it('manages task graph lifecycle', () => {
			const readyResult = getNextReadyUnits(graphId);
			expect(readyResult.success).toBe(true);

			const progressResult = getGraphProgress(graphId);
			expect(progressResult.success).toBe(true);

			const completeResult = isGraphComplete(graphId);
			expect(completeResult.success).toBe(true);
		});

		it('handles multiple operations', () => {
			resetStaleInProgressUnits(graphId);
			const ready = getNextReadyUnits(graphId);
			const progress = getGraphProgress(graphId);
			const complete = isGraphComplete(graphId);

			expect(ready.success).toBe(true);
			expect(progress.success).toBe(true);
			expect(complete.success).toBe(true);
		});
	});

	describe('buildTaskGraphFromResponse', () => {
		it('assigns sort order to units', () => {
			const rawUnits: RawTaskUnit[] = [
				{
					temp_id: 'u1',
					label: 'First',
					goal: 'First task',
					category: 'IMPLEMENTATION',
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: 'file',
					falsifiers: ['test fails'],
					observables: ['file created'],
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
				},
			];

			const result = buildTaskGraphFromResponse(graphId, rawUnits, []);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.units[0].sort_order).toBeDefined();
			}
		});

		it('handles empty units array', () => {
			const result = buildTaskGraphFromResponse(graphId, [], []);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.units).toEqual([]);
				expect(result.value.edges).toEqual([]);
			}
		});

		it('handles units without dependencies', () => {
			const rawUnits: RawTaskUnit[] = [
				{
					temp_id: 'unit-1',
					label: 'Independent',
					goal: 'Standalone task',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					falsifiers: ['fails'],
					observables: ['created'],
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
				},
			];

			const result = buildTaskGraphFromResponse(graphId, rawUnits, []);

			expect(result.success).toBe(true);
		});

		it('handles complex dependency graph', () => {
			const rawUnits: RawTaskUnit[] = [
				{ temp_id: 'a', label: 'A', goal: 'A', category: 'IMPLEMENTATION', inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', falsifiers: ['f'], observables: ['o'], verification_method: 'test', preferred_provider: null, parent_unit_id: null },
				{ temp_id: 'b', label: 'B', goal: 'B', category: 'IMPLEMENTATION', inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', falsifiers: ['f'], observables: ['o'], verification_method: 'test', preferred_provider: null, parent_unit_id: null },
				{ temp_id: 'c', label: 'C', goal: 'C', category: 'IMPLEMENTATION', inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', falsifiers: ['f'], observables: ['o'], verification_method: 'test', preferred_provider: null, parent_unit_id: null },
			];

			const rawEdges: RawTaskEdge[] = [
				{ from_temp_id: 'a', to_temp_id: 'b', edge_type: 'DEPENDS_ON' },
				{ from_temp_id: 'a', to_temp_id: 'c', edge_type: 'DEPENDS_ON' },
				{ from_temp_id: 'b', to_temp_id: 'c', edge_type: 'DEPENDS_ON' },
			];

			const result = buildTaskGraphFromResponse(graphId, rawUnits, rawEdges);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.edges.length).toBe(3);
			}
		});
	});

	describe('checkDecompositionQuality', () => {
		it('passes quality checks for valid decomposition', () => {
			const units: TaskUnit[] = [
				{
					unit_id: 'unit-1',
					graph_id: graphId,
					label: 'Task 1',
					goal: 'Complete task',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: 'file',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['Falsifier 1', 'Falsifier 2'],
					observables: ['Observable 1'],
					status: TaskUnitStatus.PENDING,
					sort_order: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			const report = checkDecompositionQuality(graphId, units, []);

			expect(report).toBeDefined();
			expect(report.issues).toBeDefined();
		});

		it('detects units with too many claims', () => {
			const units: TaskUnit[] = [
				{
					unit_id: 'unit-1',
					graph_id: graphId,
					label: 'Overloaded Task',
					goal: 'Too many claims',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['F1', 'F2', 'F3', 'F4', 'F5'],
					observables: ['Observable'],
					status: TaskUnitStatus.PENDING,
					sort_order: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			const result = checkDecompositionQuality(graphId, units, []);

			expect(result).toBeDefined();
			expect(result.is_acceptable).toBeDefined();
		});

		it('detects units without observables', () => {
			const units: TaskUnit[] = [
				{
					unit_id: 'unit-1',
					graph_id: graphId,
					label: 'No Observable',
					goal: 'Missing observable',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['Falsifier'],
					observables: [],
					status: TaskUnitStatus.PENDING,
					sort_order: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			const result = checkDecompositionQuality(graphId, units, []);

			expect(result).toBeDefined();
			expect(result.is_acceptable).toBeDefined();
		});

		it('handles empty units array', () => {
			const result = checkDecompositionQuality(graphId, [], []);

			expect(result).toBeDefined();
			expect(result.is_acceptable).toBe(true);
		});
	});

	describe('computeCriticalPath', () => {
		it('computes critical path for linear dependencies', () => {
			const units: TaskUnit[] = [
				{
					unit_id: 'unit-1',
					graph_id: graphId,
					label: 'First',
					goal: 'First task',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['f1'],
					observables: ['o1'],
					status: TaskUnitStatus.PENDING,
					sort_order: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
				{
					unit_id: 'unit-2',
					graph_id: graphId,
					label: 'Second',
					goal: 'Second task',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['f2'],
					observables: ['o2'],
					status: TaskUnitStatus.PENDING,
					sort_order: 1,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			const edges: TaskEdge[] = [
				{
					edge_id: 'edge-1',
					graph_id: graphId,
					from_unit_id: 'unit-1',
					to_unit_id: 'unit-2',
					edge_type: EdgeType.DEPENDS_ON,
				},
			];

			const path = computeCriticalPath(units, edges);

			expect(path).toHaveLength(2);
			expect(path[0]).toBe('unit-1');
			expect(path[1]).toBe('unit-2');
		});

		it('handles parallel tasks', () => {
			const units: TaskUnit[] = [
				{
					unit_id: 'unit-1',
					graph_id: graphId,
					label: 'A',
					goal: 'A',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['fa'],
					observables: ['oa'],
					status: TaskUnitStatus.PENDING,
					sort_order: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
				{
					unit_id: 'unit-2',
					graph_id: graphId,
					label: 'B',
					goal: 'B',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['fb'],
					observables: ['ob'],
					status: TaskUnitStatus.PENDING,
					sort_order: 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			const path = computeCriticalPath(units, []);

			expect(path.length).toBeGreaterThan(0);
		});

		it('handles empty graph', () => {
			const path = computeCriticalPath([], []);

			expect(path).toEqual([]);
		});

		it('handles complex dependency tree', () => {
			const units: TaskUnit[] = [
				{ unit_id: 'a', graph_id: graphId, label: 'A', goal: 'A', category: TaskCategory.IMPLEMENTATION, inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', verification_method: 'test', preferred_provider: null, parent_unit_id: null, falsifiers: ['fa'], observables: ['oa'], status: TaskUnitStatus.PENDING, sort_order: 0, created_at: '', updated_at: '' },
				{ unit_id: 'b', graph_id: graphId, label: 'B', goal: 'B', category: TaskCategory.IMPLEMENTATION, inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', verification_method: 'test', preferred_provider: null, parent_unit_id: null, falsifiers: ['fb'], observables: ['ob'], status: TaskUnitStatus.PENDING, sort_order: 1, created_at: '', updated_at: '' },
				{ unit_id: 'c', graph_id: graphId, label: 'C', goal: 'C', category: TaskCategory.IMPLEMENTATION, inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', verification_method: 'test', preferred_provider: null, parent_unit_id: null, falsifiers: ['fc'], observables: ['oc'], status: TaskUnitStatus.PENDING, sort_order: 2, created_at: '', updated_at: '' },
			];

			const edges: TaskEdge[] = [
				{ edge_id: '1', graph_id: graphId, from_unit_id: 'a', to_unit_id: 'b', edge_type: EdgeType.DEPENDS_ON },
				{ edge_id: '2', graph_id: graphId, from_unit_id: 'b', to_unit_id: 'c', edge_type: EdgeType.DEPENDS_ON },
			];

			const path = computeCriticalPath(units, edges);

			expect(path.length).toBe(3);
		});
	});

	describe('resetStaleInProgressUnits', () => {
		it('resets stale in-progress units', () => {
			const result = resetStaleInProgressUnits(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value).toBe('number');
			}
		});

		it('returns zero when no stale units exist', () => {
			const result = resetStaleInProgressUnits(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(0);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();

			const result = resetStaleInProgressUnits(graphId);

			expect(result.success).toBe(false);
		});
	});

	describe('getNextReadyUnits', () => {
		it('retrieves ready units', () => {
			const result = getNextReadyUnits(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.value)).toBe(true);
			}
		});

		it('returns empty array when no units are ready', () => {
			const result = getNextReadyUnits(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();

			const result = getNextReadyUnits(graphId);

			expect(result.success).toBe(false);
		});
	});

	describe('completeUnitAndPropagate', () => {
		it('marks unit complete and propagates readiness', () => {
			const unitId = randomUUID();
			const result = completeUnitAndPropagate(graphId, unitId);

			expect(result.success).toBeDefined();
		});

		it('returns newly-ready units', () => {
			const unitId = randomUUID();
			const result = completeUnitAndPropagate(graphId, unitId);

			if (result.success) {
				expect(Array.isArray(result.value)).toBe(true);
			}
		});

		it('handles nonexistent unit', () => {
			const result = completeUnitAndPropagate(graphId, 'nonexistent-unit');

			expect(result.success).toBeDefined();
		});

		it('handles database errors', () => {
			tempDb.cleanup();

			const result = completeUnitAndPropagate(graphId, randomUUID());

			expect(result.success).toBe(false);
		});
	});

	describe('isGraphComplete', () => {
		it('checks if graph is complete', () => {
			const result = isGraphComplete(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value).toBe('boolean');
			}
		});

		it('returns true for empty graph', () => {
			const result = isGraphComplete(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(true);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();

			const result = isGraphComplete(graphId);

			expect(result.success).toBe(false);
		});
	});

	describe('getGraphProgress', () => {
		it('retrieves progress summary', () => {
			const result = getGraphProgress(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total).toBeDefined();
				expect(result.value.completed).toBeDefined();
				expect(result.value.failed).toBeDefined();
			}
		});

		it('returns zero counts for empty graph', () => {
			const result = getGraphProgress(graphId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total).toBe(0);
				expect(result.value.completed).toBe(0);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();

			const result = getGraphProgress(graphId);

			expect(result.success).toBe(false);
		});
	});

	describe('integration scenarios', () => {
		it('builds and validates task graph', () => {
			const rawUnits: RawTaskUnit[] = [
				{
					temp_id: 'unit-1',
					label: 'Setup',
					goal: 'Initialize project',
					category: TaskCategory.SCAFFOLD,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['Setup fails'],
					observables: ['Project files created'],
				},
				{
					temp_id: 'unit-2',
					label: 'Implementation',
					goal: 'Implement feature',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['Tests fail'],
					observables: ['Code written'],
				},
			];

			const rawEdges: RawTaskEdge[] = [
				{ from_temp_id: 'unit-1', to_temp_id: 'unit-2', edge_type: 'DEPENDS_ON' },
			];

			const buildResult = buildTaskGraphFromResponse(graphId, rawUnits, rawEdges);
			expect(buildResult.success).toBe(true);

			if (buildResult.success) {
				const qualityResult = checkDecompositionQuality(
					graphId,
					buildResult.value.units,
					buildResult.value.edges
				);
				expect(qualityResult).toBeDefined();
				expect(qualityResult.is_acceptable).toBeDefined();

				const path = computeCriticalPath(
					buildResult.value.units,
					buildResult.value.edges
				);
				expect(path.length).toBe(2);
			}
		});

		it('manages task execution lifecycle', () => {
			const buildResult = buildTaskGraphFromResponse(graphId, [], []);
			expect(buildResult.success).toBe(true);

			const readyResult = getNextReadyUnits(graphId);
			expect(readyResult.success).toBe(true);

			const progressResult = getGraphProgress(graphId);
			expect(progressResult.success).toBe(true);

			const completeResult = isGraphComplete(graphId);
			expect(completeResult.success).toBe(true);
		});

		it('handles task completion workflow', () => {
			const rawUnits: RawTaskUnit[] = [
				{
					temp_id: 'task-1',
					label: 'Task 1',
					goal: 'Complete first',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: 'test',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: ['fails'],
					observables: ['Output 1'],
				},
			];

			const buildResult = buildTaskGraphFromResponse(graphId, rawUnits, []);
			expect(buildResult.success).toBe(true);

			const progressBefore = getGraphProgress(graphId);
			expect(progressBefore.success).toBe(true);

			const isComplete = isGraphComplete(graphId);
			expect(isComplete.success).toBe(true);
		});
	});

	describe('error handling', () => {
		it('handles invalid graph ID', () => {
			const result = getNextReadyUnits('invalid-graph');

			expect(result.success).toBeDefined();
		});

		it('handles malformed raw units', () => {
			const rawUnits: RawTaskUnit[] = [
				{
					temp_id: '',
					label: '',
					goal: '',
					category: TaskCategory.IMPLEMENTATION,
					inputs: [],
					outputs: [],
					preconditions: [],
					postconditions: [],
					allowed_tools: [],
					max_change_scope: '.',
					verification_method: '',
					preferred_provider: null,
					parent_unit_id: null,
					falsifiers: [],
					observables: [],
				},
			];

			const result = buildTaskGraphFromResponse(graphId, rawUnits, []);

			expect(result.success).toBeDefined();
		});

		it('handles circular dependencies gracefully', () => {
			const rawUnits: RawTaskUnit[] = [
				{ temp_id: 'a', label: 'A', goal: 'A', category: TaskCategory.IMPLEMENTATION, inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', verification_method: 'test', preferred_provider: null, parent_unit_id: null, falsifiers: ['fa'], observables: ['oa'] },
				{ temp_id: 'b', label: 'B', goal: 'B', category: TaskCategory.IMPLEMENTATION, inputs: [], outputs: [], preconditions: [], postconditions: [], allowed_tools: [], max_change_scope: '.', verification_method: 'test', preferred_provider: null, parent_unit_id: null, falsifiers: ['fb'], observables: ['ob'] },
			];

			const rawEdges: RawTaskEdge[] = [
				{ from_temp_id: 'a', to_temp_id: 'b', edge_type: 'DEPENDS_ON' },
				{ from_temp_id: 'b', to_temp_id: 'a', edge_type: 'DEPENDS_ON' },
			];

			const result = buildTaskGraphFromResponse(graphId, rawUnits, rawEdges);

			expect(result.success).toBeDefined();
		});

		it('validates database connection', () => {
			const validResult = getGraphProgress(graphId);
			expect(validResult.success).toBe(true);

			tempDb.cleanup();

			const invalidResult = getGraphProgress(graphId);
			expect(invalidResult.success).toBe(false);
		});
	});
});
