/**
 * Executor Agent — code generation and file system changes with full trace capture.
 * Based on JanumiCode Spec v2.3, §3 (Agent Roster) and §4 Phase 9.
 *
 * Wraps the CLI invocation of an Executor Agent (Claude Code CLI by default).
 * Captures:
 *   - Full Execution Trace (reasoning steps, self-corrections, tool calls, tool results)
 *   - File System Write Records for every file create/modify/delete
 *   - Refactoring Task idempotency verification
 */

import type { Database } from '../database/init';
import type { AgentInvoker, AgentInvocationResult } from '../orchestrator/agentInvoker';
import { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import { EventBus } from '../events/eventBus';
import { createHash } from 'crypto';

// ── Types ───────────────────────────────────────────────────────────

export interface ExecutionTask {
  id: string;
  taskType: 'standard' | 'refactoring';
  componentId: string;
  componentResponsibility: string;
  description: string;
  backingTool: string;
  completionCriteria: { criterionId: string; description: string }[];
  writeDirectoryPaths: string[];
  /** Refactoring task fields */
  expectedPreStateHash?: string;
  verificationStep?: string;
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  /** Files written during execution */
  filesWritten: FileWriteRecord[];
  /** Whether a refactoring task was skipped (already applied) */
  skippedIdempotent: boolean;
  /** Error if failed */
  error?: string;
}

export interface FileWriteRecord {
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  sha256Before: string | null;
  sha256After: string | null;
}

// ── ExecutorAgent ───────────────────────────────────────────────────

export class ExecutorAgent {
  constructor(
    private readonly db: Database,
    private readonly agentInvoker: AgentInvoker,
    private readonly writer: GovernedStreamWriter,
    private readonly eventBus: EventBus,
    private readonly generateId: () => string,
  ) {}

  /**
   * Execute a single implementation task.
   */
  async execute(
    task: ExecutionTask,
    workflowRunId: string,
    stdinContent: string,
    cwd: string,
    janumiCodeVersionSha: string,
  ): Promise<ExecutionResult> {
    // Refactoring task idempotency check
    if (task.taskType === 'refactoring' && task.expectedPreStateHash) {
      const idempotencyResult = this.checkRefactoringIdempotency(task);
      if (idempotencyResult === 'skip') {
        this.recordSkippedIdempotent(task, workflowRunId, janumiCodeVersionSha);
        return {
          taskId: task.id,
          success: true,
          filesWritten: [],
          skippedIdempotent: true,
        };
      }
      if (idempotencyResult === 'indeterminate') {
        return {
          taskId: task.id,
          success: false,
          filesWritten: [],
          skippedIdempotent: false,
          error: 'Refactoring target file in indeterminate state — hash mismatch and verification failed. Escalating to human.',
        };
      }
    }

    // Record invocation start
    const invocationId = this.generateId();
    this.writer.writeRecord({
      record_type: 'agent_invocation',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: janumiCodeVersionSha,
      content: {
        invocation_id: invocationId,
        task_id: task.id,
        backing_tool: task.backingTool,
        status: 'started',
      },
    });

    this.eventBus.emit('agent:invocation_started', {
      invocationId,
      agentRole: 'executor_agent',
    });

    // Invoke the CLI agent
    const result = await this.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: task.backingTool as 'claude_code_cli',
      invocationId,
      prompt: stdinContent,
      cwd,
    });

    // Record execution trace events
    if (result.cliResult) {
      for (const event of result.cliResult.events) {
        this.writer.writeRecord({
          record_type: event.recordType as 'agent_reasoning_step',
          schema_version: '1.0',
          workflow_run_id: workflowRunId,
          phase_id: '9',
          sub_phase_id: '9.1',
          produced_by_agent_role: 'executor_agent',
          produced_by_record_id: invocationId,
          janumicode_version_sha: janumiCodeVersionSha,
          content: event.data,
        });

        // Emit real-time events for the webview
        if (event.recordType === 'agent_reasoning_step') {
          this.eventBus.emit('agent:reasoning_step', {
            invocationId,
            content: (event.data.content ?? event.data.text ?? '') as string,
            sequencePosition: event.sequencePosition,
          });
        } else if (event.recordType === 'agent_self_correction') {
          this.eventBus.emit('agent:self_correction', {
            invocationId,
            content: (event.data.content ?? '') as string,
            sequencePosition: event.sequencePosition,
          });
        } else if (event.recordType === 'tool_call') {
          this.eventBus.emit('agent:tool_call', {
            invocationId,
            toolName: (event.data.name ?? '') as string,
            params: JSON.stringify(event.data.input ?? ''),
            sequencePosition: event.sequencePosition,
          });
        }
      }
    }

    this.eventBus.emit('agent:invocation_completed', {
      invocationId,
      success: result.success,
    });

    return {
      taskId: task.id,
      success: result.success,
      filesWritten: [],
      skippedIdempotent: false,
      error: result.error,
    };
  }

  /**
   * Record a file system write.
   */
  recordFileWrite(
    write: FileWriteRecord,
    invocationId: string,
    taskId: string,
    workflowRunId: string,
    janumiCodeVersionSha: string,
  ): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO file_system_writes (id, agent_invocation_id, implementation_task_id, workflow_run_id, operation, file_path, file_sha256_before, file_sha256_after, produced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.generateId(), invocationId, taskId, workflowRunId,
      write.operation, write.filePath, write.sha256Before, write.sha256After, now,
    );

    this.writer.writeRecord({
      record_type: 'file_system_write_record',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: janumiCodeVersionSha,
      content: {
        agent_invocation_id: invocationId,
        implementation_task_id: taskId,
        operation: write.operation,
        file_path: write.filePath,
        file_sha256_before: write.sha256Before,
        file_sha256_after: write.sha256After,
      },
    });
  }

  /**
   * Refactoring task idempotency check per §8.8.
   */
  private checkRefactoringIdempotency(
    task: ExecutionTask,
  ): 'proceed' | 'skip' | 'indeterminate' {
    // In production, would read the target file and compute its hash
    // For now, return 'proceed' as default
    return 'proceed';
  }

  private recordSkippedIdempotent(
    task: ExecutionTask,
    workflowRunId: string,
    janumiCodeVersionSha: string,
  ): void {
    this.writer.writeRecord({
      record_type: 'refactoring_skipped_idempotent',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: janumiCodeVersionSha,
      content: { task_id: task.id, reason: 'Verification step passed — refactoring already applied' },
    });
  }

  /**
   * Compute SHA-256 of file content.
   */
  static computeFileHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
