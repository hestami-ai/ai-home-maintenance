/**
 * Contract for Phase 9.1 — implementation_task_execution
 * (artifact kind: `execution_summary`).
 *
 * The executor agent emits an execution_summary per task. The summary
 * carries success/failure status and the verification evidence the
 * orchestrator needs to advance the wave.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface FileMutation {
  path: string;
  action?: 'created' | 'modified' | 'deleted';
}

export interface ExecutionSummaryArtifact {
  kind: 'execution_summary';
  task_id: string;
  invocation_id?: string;
  success: boolean;
  reason?: string;
  files_written?: FileMutation[] | string[];
  test_pass_count?: number;
  test_fail_count?: number;
  duration_ms?: number;
}

// ── Contract suite ───────────────────────────────────────────────

const TASK_ID_PATTERN = /^task-/;

export const phase9ImplementationTaskExecutionContract: ContractSuite<ExecutionSummaryArtifact> = {
  boundaryId: '9.1_implementation_task_execution',
  phaseId: '9',
  subPhaseId: 'implementation_task_execution',
  producerArtifactKind: 'execution_summary',
  description:
    'Phase 9 executor — each execution_summary cites the task it implemented and reports success + evidence.',
  clauses: [
    {
      id: 'C-9.1.1',
      description: 'execution_summary has a non-empty task_id matching task-*.',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.task_id || !TASK_ID_PATTERN.test(artifact.task_id)) {
          return { message: `invalid task_id: ${artifact.task_id ?? '(missing)'}` };
        }
        return true;
      },
    },
    {
      id: 'C-9.1.2',
      description: 'execution_summary has an explicit boolean success flag.',
      severity: 'blocking',
      check: (artifact) => {
        if (typeof artifact.success !== 'boolean') {
          return { message: 'success is missing or not a boolean' };
        }
        return true;
      },
    },
    {
      id: 'C-9.1.3',
      description: 'On success=true, files_written is non-empty (executor produced something).',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.success) return true;
        const writes = artifact.files_written ?? [];
        if (!Array.isArray(writes) || writes.length === 0) {
          return { message: 'success=true but files_written is empty' };
        }
        return true;
      },
    },
    {
      id: 'C-9.1.4',
      description: 'On success=false, a reason is recorded.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.success) return true;
        if (!artifact.reason || artifact.reason.trim().length === 0) {
          return { message: 'success=false but no reason recorded' };
        }
        return true;
      },
    },
    {
      id: 'C-9.1.5',
      description: 'When test counts are recorded, fails are zero on success.',
      severity: 'advisory',
      check: (artifact) => {
        if (!artifact.success) return true;
        if (artifact.test_fail_count !== undefined && artifact.test_fail_count > 0) {
          return {
            message: `success=true but test_fail_count=${artifact.test_fail_count}`,
            details: { taskId: artifact.task_id },
          };
        }
        return true;
      },
    },
  ],
};
