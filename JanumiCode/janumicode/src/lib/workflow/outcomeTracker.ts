/**
 * Outcome Tracker
 * Records OutcomeSnapshot data after workflow completion.
 * Aggregates execution data from task graph, repairs, and provider usage.
 */

import type { Result } from '../types';
import type { OutcomeSnapshot, ProviderUsageRecord, TaskUnit, RepairPacket } from '../types/maker';
import {
	getTaskGraphForDialogue,
	getTaskUnitsForGraph,
	getRepairPacketsForUnit,
	createOutcomeSnapshot,
} from '../database/makerStore';
import { getGraphProgress } from './taskGraph';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Record an outcome snapshot for a completed dialogue.
 * Aggregates all execution data from the task graph and its units.
 *
 * @param dialogueId Dialogue ID
 * @param startTimeMs Workflow start timestamp (Date.now() at start)
 * @returns Result containing the recorded snapshot
 */
export function recordOutcomeSnapshot(
	dialogueId: string,
	startTimeMs?: number
): Result<OutcomeSnapshot> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'outcomeTracker', dialogueId })
		: undefined;

	try {
		const graphResult = getTaskGraphForDialogue(dialogueId);
		if (!graphResult.success || !graphResult.value) {
			return {
				success: false,
				error: new Error('No task graph found for dialogue'),
			};
		}

		const graph = graphResult.value;
		const progress = getGraphProgress(graph.graph_id);
		const unitsResult = getTaskUnitsForGraph(graph.graph_id);
		const units: TaskUnit[] = unitsResult.success ? unitsResult.value : [];

		// Collect all repairs across units
		const allRepairs: RepairPacket[] = [];
		for (const unit of units) {
			const repairsResult = getRepairPacketsForUnit(unit.unit_id);
			if (repairsResult.success) {
				allRepairs.push(...repairsResult.value);
			}
		}

		// Extract failure modes from failed units
		const failureModes = units
			.filter((u) => u.status === 'FAILED')
			.map((u) => `${u.label}: ${u.goal.substring(0, 100)}`);

		// Extract useful invariants from successful repairs
		const usefulInvariants = extractUsefulInvariants(units, allRepairs);

		// Calculate wall clock time
		const totalWallClockMs = startTimeMs ? Date.now() - startTimeMs : 0;

		const result = createOutcomeSnapshot(dialogueId, graph.graph_id, {
			providers_used: [],
			augmentations_used: [],
			success: graph.graph_status === 'COMPLETED',
			failure_modes: failureModes,
			useful_invariants: usefulInvariants,
			units_completed: progress.success ? progress.value.completed : 0,
			units_total: progress.success ? progress.value.total : 0,
			total_wall_clock_ms: totalWallClockMs,
		});

		if (result.success) {
			logger?.info('Outcome snapshot recorded', {
				snapshotId: result.value.snapshot_id,
				success: result.value.success,
				unitsCompleted: result.value.units_completed,
				unitsTotal: result.value.units_total,
			});
		}

		return result;
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to record outcome snapshot'),
		};
	}
}

/**
 * Extract useful invariants from execution history.
 * Patterns that led to successful repairs or consistently successful units
 * become reusable lessons for future dialogues.
 */
export function extractUsefulInvariants(
	units: TaskUnit[],
	repairs: RepairPacket[]
): string[] {
	const invariants: string[] = [];

	// Successful repairs indicate patterns worth remembering
	const fixedRepairs = repairs.filter((r) => r.result === 'FIXED');
	for (const repair of fixedRepairs) {
		if (repair.suspected_cause && repair.repair_strategy) {
			invariants.push(
				`When "${repair.suspected_cause}" occurs, strategy "${repair.repair_strategy}" is effective`
			);
		}
	}

	// Units that completed without any repairs on first try
	const repairedUnitIds = new Set(repairs.map((r) => r.unit_id));
	const firstTrySuccess = units.filter(
		(u) => u.status === 'COMPLETED' && !repairedUnitIds.has(u.unit_id)
	);

	if (firstTrySuccess.length > 0 && units.length > 0) {
		const successRate = Math.round((firstTrySuccess.length / units.length) * 100);
		invariants.push(
			`First-try success rate: ${successRate}% (${firstTrySuccess.length}/${units.length} units)`
		);
	}

	// Patterns from escalated repairs (what NOT to auto-repair)
	const escalated = repairs.filter((r) => r.result === 'ESCALATED');
	for (const repair of escalated) {
		if (repair.suspected_cause) {
			invariants.push(
				`Auto-repair should not attempt "${repair.suspected_cause}" — requires human judgment`
			);
		}
	}

	return invariants;
}
