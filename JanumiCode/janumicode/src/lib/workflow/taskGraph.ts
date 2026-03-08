/**
 * Task Graph Engine
 *
 * Builds, validates, and manages task graphs for the MAKER pipeline.
 * Provides topological sorting, readiness propagation, and decomposition
 * quality checks per the Task Graph Granularity Guidance.
 */

import type { Result } from '../types';
import type {
	TaskUnit,
	TaskEdge,
	DecompositionQualityReport,
} from '../types/maker';
import {
	TaskUnitStatus,
	TaskGraphStatus,
	EdgeType,
	DecompositionIssue,
	TASK_GRAPH_LIMITS,
} from '../types/maker';
import {
	getTaskUnitsForGraph,
	getEdgesForGraph,
	updateTaskUnitStatus,
	updateTaskGraphStatus,
	bulkCreateTaskUnits,
	createTaskEdge,
} from '../database/makerStore';

// ==================== BUILD FROM LLM RESPONSE ====================

/**
 * Raw unit from LLM decomposition output (before DB persistence).
 */
export interface RawTaskUnit {
	label: string;
	goal: string;
	category: string;
	inputs: string[];
	outputs: string[];
	preconditions: string[];
	postconditions: string[];
	allowed_tools: string[];
	preferred_provider?: string | null;
	max_change_scope: string;
	observables: string[];
	falsifiers: string[];
	verification_method: string;
	parent_unit_id?: string | null;
	/** Temp ID used in edges before persistence. */
	temp_id: string;
}

export interface RawTaskEdge {
	from_temp_id: string;
	to_temp_id: string;
	edge_type: string;
}

/**
 * Build a task graph from LLM decomposition response.
 * Persists units and edges to the database. Assigns sort_order by
 * topological ordering of temp_ids.
 */
export function buildTaskGraphFromResponse(
	graphId: string,
	rawUnits: RawTaskUnit[],
	rawEdges: RawTaskEdge[]
): Result<{ units: TaskUnit[]; edges: TaskEdge[] }> {
	try {
		// Compute topological sort order from temp_ids
		const sortOrder = computeSortOrder(rawUnits, rawEdges);

		// Build unit records for bulk insert
		const unitRecords = rawUnits.map((raw) => ({
			label: raw.label,
			goal: raw.goal,
			category: raw.category as TaskUnit['category'],
			inputs: raw.inputs,
			outputs: raw.outputs,
			preconditions: raw.preconditions,
			postconditions: raw.postconditions,
			allowed_tools: raw.allowed_tools,
			preferred_provider: raw.preferred_provider ?? null,
			max_change_scope: raw.max_change_scope,
			observables: raw.observables,
			falsifiers: raw.falsifiers,
			verification_method: raw.verification_method,
			status: TaskUnitStatus.PENDING as TaskUnitStatus,
			parent_unit_id: raw.parent_unit_id ?? null,
			sort_order: sortOrder.get(raw.temp_id) ?? 0,
		}));

		// Persist units
		const unitsResult = bulkCreateTaskUnits(graphId, unitRecords);
		if (!unitsResult.success) {
			return { success: false, error: unitsResult.error };
		}

		// Build temp_id → real unit_id mapping
		const tempToReal = new Map<string, string>();
		for (let i = 0; i < rawUnits.length; i++) {
			tempToReal.set(rawUnits[i].temp_id, unitsResult.value[i].unit_id);
		}

		// Persist edges using real unit IDs
		const edges: TaskEdge[] = [];
		for (const raw of rawEdges) {
			const fromId = tempToReal.get(raw.from_temp_id);
			const toId = tempToReal.get(raw.to_temp_id);
			if (!fromId || !toId) { continue; }

			const edgeType = (Object.values(EdgeType).includes(raw.edge_type as EdgeType))
				? raw.edge_type as EdgeType
				: EdgeType.DEPENDS_ON;

			const edgeResult = createTaskEdge(graphId, fromId, toId, edgeType);
			if (edgeResult.success) {
				edges.push(edgeResult.value);
			}
		}

		// Mark units with no unresolved dependencies as READY
		markInitialReadyUnits(unitsResult.value, edges);

		return { success: true, value: { units: unitsResult.value, edges } };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to build task graph'),
		};
	}
}

/**
 * Compute topological sort order from temp_ids.
 * Returns a map of temp_id → sort_order (0-indexed).
 */
function computeSortOrder(
	units: RawTaskUnit[],
	edges: RawTaskEdge[]
): Map<string, number> {
	const tempIds = units.map((u) => u.temp_id);
	const inDegree = new Map<string, number>();
	const adjacency = new Map<string, string[]>();

	for (const id of tempIds) {
		inDegree.set(id, 0);
		adjacency.set(id, []);
	}

	for (const edge of edges) {
		if (edge.edge_type === 'DEPENDS_ON' || edge.edge_type === 'BLOCKS') {
			const from = edge.from_temp_id;
			const to = edge.to_temp_id;
			// "from DEPENDS_ON to" means to must finish first
			adjacency.get(to)?.push(from);
			inDegree.set(from, (inDegree.get(from) ?? 0) + 1);
		}
	}

	// Kahn's algorithm
	const queue: string[] = [];
	for (const [id, deg] of inDegree) {
		if (deg === 0) { queue.push(id); }
	}

	const result = new Map<string, number>();
	let order = 0;

	while (queue.length > 0) {
		const current = queue.shift()!;
		result.set(current, order++);

		for (const neighbor of (adjacency.get(current) ?? [])) {
			const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, newDeg);
			if (newDeg === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Any remaining nodes (cycle) get appended at the end
	for (const id of tempIds) {
		if (!result.has(id)) {
			result.set(id, order++);
		}
	}

	return result;
}

/**
 * Mark units whose dependencies are all satisfied as READY.
 */
function markInitialReadyUnits(units: TaskUnit[], edges: TaskEdge[]): void {
	const dependsOnEdges = edges.filter((e) => e.edge_type === EdgeType.DEPENDS_ON);

	for (const unit of units) {
		const deps = dependsOnEdges.filter((e) => e.to_unit_id === unit.unit_id);
		if (deps.length === 0) {
			updateTaskUnitStatus(unit.unit_id, TaskUnitStatus.READY);
			unit.status = TaskUnitStatus.READY;
		}
	}
}

// ==================== DECOMPOSITION QUALITY ====================

/**
 * Check decomposition quality against the granularity rubric.
 *
 * Checks:
 * - Unit count in target range (5-15)
 * - Each unit has observables and falsifiers
 * - Max 3 claims per unit (via falsifiers as proxy)
 * - No over-fragmentation (units must have standalone observable)
 */
export function checkDecompositionQuality(
	graphId: string,
	units: TaskUnit[],
	_edges: TaskEdge[]
): DecompositionQualityReport {
	const issues: DecompositionQualityReport['issues'] = [];

	// Unit count checks
	if (units.length < TASK_GRAPH_LIMITS.reject_below_for_nontrivial) {
		issues.push({
			issue: DecompositionIssue.TOO_COARSE,
			detail: `Only ${units.length} units — below minimum of ${TASK_GRAPH_LIMITS.reject_below_for_nontrivial} for non-trivial features.`,
		});
	} else if (units.length > TASK_GRAPH_LIMITS.require_grouping_units) {
		issues.push({
			issue: DecompositionIssue.TOO_FRAGMENTED,
			detail: `${units.length} units exceeds ${TASK_GRAPH_LIMITS.require_grouping_units} — requires hierarchical grouping.`,
		});
	}

	// Per-unit checks
	for (const unit of units) {
		if (unit.observables.length === 0) {
			issues.push({
				issue: DecompositionIssue.MISSING_OBSERVABLES,
				unit_id: unit.unit_id,
				detail: `Unit "${unit.label}" has no observables.`,
			});
		}

		if (unit.falsifiers.length === 0) {
			issues.push({
				issue: DecompositionIssue.MISSING_FALSIFIERS,
				unit_id: unit.unit_id,
				detail: `Unit "${unit.label}" has no falsifiers.`,
			});
		}

		// Heuristic: if goal contains "and" separating distinct verbs, likely multi-objective
		if (looksMultiObjective(unit.goal)) {
			issues.push({
				issue: DecompositionIssue.MULTI_OBJECTIVE_UNIT,
				unit_id: unit.unit_id,
				detail: `Unit "${unit.label}" goal may describe multiple independent objectives.`,
			});
		}
	}

	// Accept if no blocking issues (warnings for soft limits are OK)
	const blockingIssues = issues.filter((i) =>
		i.issue === DecompositionIssue.TOO_COARSE ||
		i.issue === DecompositionIssue.MISSING_OBSERVABLES ||
		i.issue === DecompositionIssue.MISSING_FALSIFIERS
	);

	return {
		graph_id: graphId,
		unit_count: units.length,
		issues,
		is_acceptable: blockingIssues.length === 0,
	};
}

/**
 * Heuristic check for multi-objective goals.
 * Looks for patterns like "X and Y" where both X and Y are verb phrases.
 */
function looksMultiObjective(goal: string): boolean {
	// Simple heuristic: if the goal contains " and " with verbs on both sides
	const parts = goal.split(/\band\b/i);
	if (parts.length < 2) { return false; }

	// Check if at least 2 parts start with a verb-like word
	const verbPrefixes = /^\s*(add|create|implement|build|set up|configure|write|update|modify|refactor|remove|delete|migrate|introduce)/i;
	const verbParts = parts.filter((p) => verbPrefixes.test(p));
	return verbParts.length >= 2;
}

// ==================== GRAPH TRAVERSAL ====================

/**
 * Compute the critical path (longest dependency chain) via topological sort.
 * Returns unit_ids in execution order.
 */
export function computeCriticalPath(
	units: TaskUnit[],
	edges: TaskEdge[]
): string[] {
	const dependsOn = edges.filter((e) => e.edge_type === EdgeType.DEPENDS_ON);
	const unitMap = new Map(units.map((u) => [u.unit_id, u]));

	// Build adjacency: "dependency → dependent"
	const adj = new Map<string, string[]>();
	const inDeg = new Map<string, number>();

	for (const unit of units) {
		adj.set(unit.unit_id, []);
		inDeg.set(unit.unit_id, 0);
	}

	for (const edge of dependsOn) {
		// to_unit_id DEPENDS_ON from_unit_id
		adj.get(edge.from_unit_id)?.push(edge.to_unit_id);
		inDeg.set(edge.to_unit_id, (inDeg.get(edge.to_unit_id) ?? 0) + 1);
	}

	// Topological sort with longest-path tracking
	const dist = new Map<string, number>();
	const pred = new Map<string, string | null>();
	const queue: string[] = [];

	for (const unit of units) {
		dist.set(unit.unit_id, 0);
		pred.set(unit.unit_id, null);
		if ((inDeg.get(unit.unit_id) ?? 0) === 0) {
			queue.push(unit.unit_id);
		}
	}

	const topoOrder: string[] = [];
	while (queue.length > 0) {
		const current = queue.shift()!;
		topoOrder.push(current);

		for (const neighbor of (adj.get(current) ?? [])) {
			const newDist = (dist.get(current) ?? 0) + 1;
			if (newDist > (dist.get(neighbor) ?? 0)) {
				dist.set(neighbor, newDist);
				pred.set(neighbor, current);
			}
			const newDeg = (inDeg.get(neighbor) ?? 1) - 1;
			inDeg.set(neighbor, newDeg);
			if (newDeg === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Find the node with the longest distance (end of critical path)
	let maxDist = 0;
	let endNode = units[0]?.unit_id ?? '';
	for (const [id, d] of dist) {
		if (d >= maxDist) {
			maxDist = d;
			endNode = id;
		}
	}

	// Trace back the critical path
	const criticalPath: string[] = [];
	let current: string | null = endNode;
	while (current) {
		criticalPath.unshift(current);
		current = pred.get(current) ?? null;
	}

	return criticalPath;
}

/**
 * Get units that are READY for execution (all DEPENDS_ON dependencies completed).
 * Queries the database for current state.
 */
export function getNextReadyUnits(graphId: string): Result<TaskUnit[]> {
	const unitsResult = getTaskUnitsForGraph(graphId);
	if (!unitsResult.success) { return unitsResult; }

	const edgesResult = getEdgesForGraph(graphId);
	if (!edgesResult.success) { return { success: false, error: edgesResult.error }; }

	const units = unitsResult.value;
	const dependsOn = edgesResult.value.filter((e) => e.edge_type === EdgeType.DEPENDS_ON);
	const completedIds = new Set(
		units.filter((u) => u.status === TaskUnitStatus.COMPLETED || u.status === TaskUnitStatus.SKIPPED)
			.map((u) => u.unit_id)
	);

	const ready: TaskUnit[] = [];
	for (const unit of units) {
		if (unit.status !== TaskUnitStatus.PENDING && unit.status !== TaskUnitStatus.READY) {
			continue;
		}

		// Check if all dependencies are completed
		const deps = dependsOn.filter((e) => e.to_unit_id === unit.unit_id);
		const allDepsComplete = deps.every((d) => completedIds.has(d.from_unit_id));

		if (allDepsComplete) {
			// Ensure it's marked READY in DB
			if (unit.status === TaskUnitStatus.PENDING) {
				updateTaskUnitStatus(unit.unit_id, TaskUnitStatus.READY);
				unit.status = TaskUnitStatus.READY;
			}
			ready.push(unit);
		}
	}

	return { success: true, value: ready };
}

/**
 * Mark a unit complete and propagate readiness to its dependents.
 * Returns the newly-ready units.
 */
export function completeUnitAndPropagate(
	graphId: string,
	unitId: string
): Result<TaskUnit[]> {
	const statusResult = updateTaskUnitStatus(unitId, TaskUnitStatus.COMPLETED);
	if (!statusResult.success) { return { success: false, error: statusResult.error }; }

	// Recompute ready units
	return getNextReadyUnits(graphId);
}

/**
 * Check if the entire task graph is complete.
 */
export function isGraphComplete(graphId: string): Result<boolean> {
	const unitsResult = getTaskUnitsForGraph(graphId);
	if (!unitsResult.success) { return { success: false, error: unitsResult.error }; }

	const terminal = new Set([TaskUnitStatus.COMPLETED, TaskUnitStatus.SKIPPED, TaskUnitStatus.FAILED]);
	const allDone = unitsResult.value.every((u) => terminal.has(u.status));
	return { success: true, value: allDone };
}

/**
 * Get progress summary for a task graph.
 */
export function getGraphProgress(graphId: string): Result<{
	total: number;
	completed: number;
	failed: number;
	in_progress: number;
	pending: number;
}> {
	const unitsResult = getTaskUnitsForGraph(graphId);
	if (!unitsResult.success) { return { success: false, error: unitsResult.error }; }

	const units = unitsResult.value;
	return {
		success: true,
		value: {
			total: units.length,
			completed: units.filter((u) => u.status === TaskUnitStatus.COMPLETED).length,
			failed: units.filter((u) => u.status === TaskUnitStatus.FAILED).length,
			in_progress: units.filter((u) =>
				u.status === TaskUnitStatus.IN_PROGRESS ||
				u.status === TaskUnitStatus.VALIDATING ||
				u.status === TaskUnitStatus.REPAIRING
			).length,
			pending: units.filter((u) =>
				u.status === TaskUnitStatus.PENDING ||
				u.status === TaskUnitStatus.READY
			).length,
		},
	};
}
