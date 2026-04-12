/**
 * DependencyClosureResolver — traverses memory_edge table for full dependency
 * closure on rollbacks.
 * Based on JanumiCode Spec v2.3, §5.3.
 *
 * Cycle detection via DFS with visited set.
 * Cross-run boundary stops (never invalidates prior-run artifacts).
 * Phase Gate invalidation tracking.
 * Closure size limit check.
 */

import type { Database } from '../database/init';

// ── Types ───────────────────────────────────────────────────────────

export interface ClosureResult {
  /** All artifact IDs in the dependency closure */
  closureIds: string[];
  /** Artifacts referenced but not invalidated (prior run) */
  crossRunReferences: string[];
  /** Phase Gates affected by the closure */
  affectedPhaseGates: string[];
  /** Whether a cycle was detected */
  cycleDetected: boolean;
  /** Cycle details if detected */
  cycleEdges?: { from: string; to: string }[];
  /** Whether the closure exceeds the configured size limit */
  exceedsLimit: boolean;
  /** Total closure size */
  closureSize: number;
}

// ── DependencyClosureResolver ───────────────────────────────────────

export class DependencyClosureResolver {
  constructor(
    private readonly db: Database,
    private readonly maxClosureSize: number = 50,
  ) {}

  /**
   * Compute the full dependency closure for a rollback target.
   * Traverses all derives_from edges recursively.
   */
  computeClosure(
    targetArtifactId: string,
    currentWorkflowRunId: string,
  ): ClosureResult {
    const closure = new Set<string>();
    const crossRunRefs: string[] = [];
    const visited = new Set<string>();
    const cycleEdges: { from: string; to: string }[] = [];
    let cycleDetected = false;

    // DFS traversal
    const stack: string[] = [targetArtifactId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (visited.has(current)) {
        // Cycle detected
        cycleDetected = true;
        continue;
      }

      visited.add(current);
      closure.add(current);

      // Find all records that derive from this one
      const edges = this.db.prepare(`
        SELECT source_record_id, target_record_id
        FROM memory_edge
        WHERE target_record_id = ? AND edge_type = 'derives_from'
          AND status IN ('confirmed', 'system_asserted')
      `).all(current) as { source_record_id: string; target_record_id: string }[];

      for (const edge of edges) {
        const childId = edge.source_record_id;

        // Check cross-run boundary
        const childRecord = this.db.prepare(`
          SELECT source_workflow_run_id FROM governed_stream WHERE id = ?
        `).get(childId) as { source_workflow_run_id: string } | undefined;

        if (childRecord && childRecord.source_workflow_run_id !== currentWorkflowRunId) {
          // Cross-run boundary — do not invalidate, just reference
          crossRunRefs.push(childId);
          continue;
        }

        if (visited.has(childId)) {
          // Cycle
          cycleDetected = true;
          cycleEdges.push({ from: current, to: childId });
          continue;
        }

        stack.push(childId);
      }
    }

    // Find affected Phase Gates
    const affectedPhaseGates = this.findAffectedPhaseGates(closure, currentWorkflowRunId);

    return {
      closureIds: Array.from(closure),
      crossRunReferences: crossRunRefs,
      affectedPhaseGates,
      cycleDetected,
      cycleEdges: cycleDetected ? cycleEdges : undefined,
      exceedsLimit: closure.size > this.maxClosureSize,
      closureSize: closure.size,
    };
  }

  /**
   * Find Phase Gates that certified any artifact in the closure.
   */
  private findAffectedPhaseGates(
    closure: Set<string>,
    workflowRunId: string,
  ): string[] {
    const gates = this.db.prepare(`
      SELECT id FROM phase_gates WHERE workflow_run_id = ?
    `).all(workflowRunId) as { id: string }[];

    // Check which gates validated closure artifacts
    const affected: string[] = [];
    for (const gate of gates) {
      const edges = this.db.prepare(`
        SELECT target_record_id FROM memory_edge
        WHERE source_record_id = ? AND edge_type = 'validates'
      `).all(gate.id) as { target_record_id: string }[];

      for (const edge of edges) {
        if (closure.has(edge.target_record_id)) {
          affected.push(gate.id);
          break;
        }
      }
    }

    return affected;
  }

  /**
   * Execute the rollback — mark all closure artifacts as non-current.
   * Records must be confirmed by human before calling this.
   */
  executeRollback(
    closure: ClosureResult,
    rollbackRecordId: string,
    workflowRunId: string,
  ): void {
    const now = new Date().toISOString();

    for (const artifactId of closure.closureIds) {
      this.db.prepare(`
        UPDATE governed_stream
        SET is_current_version = 0, superseded_by_id = ?, superseded_at = ?
        WHERE id = ? AND workflow_run_id = ?
      `).run(rollbackRecordId, now, artifactId, workflowRunId);
    }

    // Invalidate affected Phase Gates
    for (const gateId of closure.affectedPhaseGates) {
      this.db.prepare(`
        UPDATE phase_gates SET invalidated_by_rollback_at = ? WHERE id = ?
      `).run(now, gateId);
    }

    // Invalidate memory edges in the closure
    for (const artifactId of closure.closureIds) {
      this.db.prepare(`
        UPDATE memory_edge SET status = 'invalidated'
        WHERE (source_record_id = ? OR target_record_id = ?)
          AND status IN ('confirmed', 'system_asserted', 'proposed')
      `).run(artifactId, artifactId);
    }
  }
}
