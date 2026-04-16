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
import type { AgentInvoker } from '../orchestrator/agentInvoker';
import { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import { EventBus } from '../events/eventBus';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../logging';

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
  /**
   * How this write was detected. We run BOTH a filesystem snapshot diff
   * AND tool-event parsing so we can audit when the two disagree. The
   * snapshot is the source of truth for what actually changed on disk;
   * tool events describe what the agent *claimed* to do.
   *   - 'snapshot_diff' — only the disk diff saw it (agent did the work
   *     without announcing it, or we missed parsing its event)
   *   - 'tool_event'    — only the tool stream saw it (agent announced
   *     a write that didn't actually land: dry-run, refused, or outside
   *     the task's writeDirectoryPaths)
   *   - 'both'          — corroborated
   */
  detectionSource: 'snapshot_diff' | 'tool_event' | 'both';
  /**
   * True when the two detectors disagreed about whether this file
   * actually changed. Makes drift easy to grep for in the governed
   * stream without having to reason about detection_source alone.
   */
  driftDetected: boolean;
  /**
   * For tool-event detections, the tool name ('Write', 'Edit', …).
   * Null when only the snapshot saw the change.
   */
  toolName: string | null;
}

/**
 * Which backing tool actually does the execution work. Distinct from
 * `ExecutionTask.backingTool`, which is descriptive infrastructure
 * metadata (e.g. "DBOS Middleware / PostgreSQL RLS Policies" — not an
 * invocation target). Routing the task's backing_tool to AgentInvoker
 * always produces "No output parser registered" errors because those
 * strings aren't registered executor CLIs; they're the dependencies
 * the generated code will touch. The executor's *own* backing tool
 * is the coding agent we hand the task off to (Claude Code, or a
 * direct LLM API), and it's the same value for every task in a run.
 */
export type ExecutorBackingTool =
  | 'claude_code_cli'
  | 'gemini_cli'
  | 'codex_cli'
  | 'direct_llm_api';

export interface ExecutorAgentOptions {
  /**
   * The coding agent that actually implements tasks. Default
   * `claude_code_cli`. When the invoker has no parser registered for
   * this value, the failure surfaces as a clear "register an executor"
   * gap rather than the misleading "register the infrastructure as a
   * parser" confusion it produced before.
   */
  executorBackingTool?: ExecutorBackingTool;
}

// ── ExecutorAgent ───────────────────────────────────────────────────

export class ExecutorAgent {
  private readonly executorBackingTool: ExecutorBackingTool;

  constructor(
    private readonly db: Database,
    private readonly agentInvoker: AgentInvoker,
    private readonly writer: GovernedStreamWriter,
    private readonly eventBus: EventBus,
    private readonly generateId: () => string,
    options?: ExecutorAgentOptions,
  ) {
    this.executorBackingTool = options?.executorBackingTool ?? 'claude_code_cli';
  }

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
      const idempotencyResult = await this.checkRefactoringIdempotency(task, cwd);
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

    // Pre-snapshot the task's declared write directories. File writes
    // land on disk between this snapshot and the post-invocation one
    // below; diffing gives us ground truth regardless of whether the
    // CLI agent announces each write in its tool-call stream.
    const preSnapshot = this.snapshotWriteDirectories(task.writeDirectoryPaths, cwd);

    // Invoke the coding agent. IMPORTANT: backingTool here is the
    // executor identity (claude_code_cli et al.) — NOT the task's
    // `backing_tool` descriptive field, which describes the
    // infrastructure the generated code will touch. Conflating those
    // was the source of the "No output parser registered for backing
    // tool: DBOS Middleware / PostgreSQL RLS Policies" cascade.
    //
    // The task's own backing_tool is surfaced to the executor via the
    // stdinContent assembled upstream by ExecutionContextBuilder, so
    // the coding agent still knows what dependencies it's writing
    // against.
    const result = await this.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: this.executorBackingTool,
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

    // Post-snapshot and merge the two detection streams. Each detected
    // write lands as a file_system_writes row AND a
    // file_system_write_record governed_stream record, both carrying
    // detection_source + drift_detected so audits can reason about how
    // well the agent's self-report matches reality.
    const postSnapshot = this.snapshotWriteDirectories(task.writeDirectoryPaths, cwd);
    const snapshotDetections = this.diffSnapshots(preSnapshot, postSnapshot);
    const toolEventDetections = this.extractFileWritesFromEvents(
      result.cliResult?.events ?? [],
      cwd,
    );
    const filesWritten = this.mergeDetections(
      snapshotDetections,
      toolEventDetections,
      preSnapshot,
      postSnapshot,
    );
    for (const write of filesWritten) {
      this.recordFileWrite(write, invocationId, task.id, workflowRunId, janumiCodeVersionSha);
    }

    return {
      taskId: task.id,
      success: result.success,
      filesWritten,
      skippedIdempotent: false,
      error: result.error,
    };
  }

  // ── File-write detection helpers ────────────────────────────────────

  /**
   * Snapshot every file under the task's declared write directories,
   * returning a Map<absolutePath, sha256>. Missing paths are silently
   * skipped so pre-existing non-existent dirs don't crash the executor.
   * A safety cap limits the scan to 10K files per call — writes that
   * land outside this budget are still captured via the tool-event path.
   */
  private snapshotWriteDirectories(
    writeDirectoryPaths: string[],
    cwd: string,
  ): Map<string, string> {
    const snapshot = new Map<string, string>();
    const MAX_FILES = 10_000;
    for (const rel of writeDirectoryPaths) {
      const abs = path.isAbsolute(rel) ? rel : path.resolve(cwd, rel);
      if (!fs.existsSync(abs)) continue;
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        this.walkDirectory(abs, snapshot, MAX_FILES);
      } else if (stat.isFile()) {
        snapshot.set(abs, this.hashFile(abs));
      }
      if (snapshot.size >= MAX_FILES) {
        getLogger().warn('agent', 'File snapshot truncated at budget', {
          cap: MAX_FILES,
          lastPath: abs,
        });
        break;
      }
    }
    return snapshot;
  }

  private walkDirectory(dir: string, snapshot: Map<string, string>, max: number): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (snapshot.size >= max) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDirectory(full, snapshot, max);
      } else if (entry.isFile()) {
        snapshot.set(full, this.hashFile(full));
      }
    }
  }

  private hashFile(abs: string): string {
    try {
      const buf = fs.readFileSync(abs);
      return createHash('sha256').update(buf).digest('hex');
    } catch {
      return '';
    }
  }

  /**
   * Diff two filesystem snapshots into create/modify/delete operations.
   */
  private diffSnapshots(
    before: Map<string, string>,
    after: Map<string, string>,
  ): Array<{
    filePath: string;
    operation: 'create' | 'modify' | 'delete';
    sha256Before: string | null;
    sha256After: string | null;
  }> {
    const writes: Array<{
      filePath: string;
      operation: 'create' | 'modify' | 'delete';
      sha256Before: string | null;
      sha256After: string | null;
    }> = [];
    const allPaths = new Set([...before.keys(), ...after.keys()]);
    for (const p of allPaths) {
      const b = before.get(p);
      const a = after.get(p);
      if (b === undefined && a !== undefined) {
        writes.push({ filePath: p, operation: 'create', sha256Before: null, sha256After: a });
      } else if (b !== undefined && a === undefined) {
        writes.push({ filePath: p, operation: 'delete', sha256Before: b, sha256After: null });
      } else if (b !== undefined && a !== undefined && b !== a) {
        writes.push({ filePath: p, operation: 'modify', sha256Before: b, sha256After: a });
      }
    }
    return writes;
  }

  /**
   * Scan CLI tool-call events for file-writing operations and return the
   * target paths resolved to absolute form. Covers the tool names used
   * by Claude Code (Write/Edit/MultiEdit) and Gemini CLI (write_file,
   * edit_file). Tools that delete go into a separate bucket.
   */
  private extractFileWritesFromEvents(
    events: Array<{ recordType: string; data: Record<string, unknown> }>,
    cwd: string,
  ): Array<{ filePath: string; operation: 'create' | 'modify' | 'delete'; toolName: string }> {
    const writeTools = new Set(['Write', 'Edit', 'MultiEdit', 'write_file', 'edit_file']);
    const deleteTools = new Set(['Delete', 'delete_file']);
    const results: Array<{
      filePath: string;
      operation: 'create' | 'modify' | 'delete';
      toolName: string;
    }> = [];
    for (const event of events) {
      if (event.recordType !== 'tool_call') continue;
      const toolName = (event.data.name ?? event.data.tool ?? '') as string;
      if (!toolName) continue;
      const input = event.data.input as Record<string, unknown> | undefined;
      const raw = (input?.file_path ?? input?.path) as string | undefined;
      if (!raw) continue;
      const abs = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
      if (writeTools.has(toolName)) {
        // 'create' vs 'modify' is resolved later against the pre-snapshot.
        results.push({ filePath: abs, operation: 'modify', toolName });
      } else if (deleteTools.has(toolName)) {
        results.push({ filePath: abs, operation: 'delete', toolName });
      }
    }
    return results;
  }

  /**
   * Merge snapshot-diff and tool-event detections into a single
   * FileWriteRecord list, stamping detection_source and drift_detected.
   *
   * - Path present in snapshot + tool-event → detection_source='both'
   * - Path present only in snapshot          → 'snapshot_diff' (agent
   *   did the write silently)
   * - Path present only in tool-event        → 'tool_event' + drift=true
   *   (agent announced a write that left no trace on disk)
   */
  private mergeDetections(
    snapshot: Array<{
      filePath: string;
      operation: 'create' | 'modify' | 'delete';
      sha256Before: string | null;
      sha256After: string | null;
    }>,
    toolEvent: Array<{
      filePath: string;
      operation: 'create' | 'modify' | 'delete';
      toolName: string;
    }>,
    preSnapshot: Map<string, string>,
    postSnapshot: Map<string, string>,
  ): FileWriteRecord[] {
    const toolEventByPath = new Map<string, { toolName: string; operation: 'create' | 'modify' | 'delete' }>();
    for (const te of toolEvent) {
      // If the same path was touched by multiple tool calls, keep the
      // last one's tool name — it's usually the one that actually
      // landed the final state.
      toolEventByPath.set(te.filePath, { toolName: te.toolName, operation: te.operation });
    }

    const merged: FileWriteRecord[] = [];
    const seen = new Set<string>();

    for (const s of snapshot) {
      const te = toolEventByPath.get(s.filePath);
      merged.push({
        filePath: s.filePath,
        operation: s.operation,
        sha256Before: s.sha256Before,
        sha256After: s.sha256After,
        detectionSource: te ? 'both' : 'snapshot_diff',
        driftDetected: false, // snapshot saw the change, so it really happened
        toolName: te?.toolName ?? null,
      });
      seen.add(s.filePath);
    }

    for (const [absPath, te] of toolEventByPath) {
      if (seen.has(absPath)) continue;
      // Tool claimed a write but the snapshot diff saw no change.
      // Examples: write was outside writeDirectoryPaths, a refused/dry
      // tool call, or an idempotent no-op. Record it with drift=true
      // so audits can see the drift rate.
      const before = preSnapshot.get(absPath) ?? null;
      const after = postSnapshot.get(absPath) ?? null;
      merged.push({
        filePath: absPath,
        operation: te.operation,
        sha256Before: before,
        sha256After: after,
        detectionSource: 'tool_event',
        driftDetected: true,
        toolName: te.toolName,
      });
    }

    return merged;
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
        // Dual-detection audit fields — see FileWriteRecord docstring.
        detection_source: write.detectionSource,
        drift_detected: write.driftDetected,
        tool_name: write.toolName,
      },
    });
  }

  /**
   * Refactoring task idempotency check per §8.8.
   * 
   * Verifies whether a refactoring task has already been applied by:
   * 1. Computing the hash of target file(s)
   * 2. Comparing against expected_pre_state_hash
   * 3. If mismatch, running verification_step to determine if already applied
   * 
   * @param task The refactoring task to check
   * @param cwd The workspace root for resolving file paths
   * @returns 'proceed' if task should run, 'skip' if already applied, 'indeterminate' if cannot determine
   */
  private async checkRefactoringIdempotency(
    task: ExecutionTask,
    cwd: string,
  ): Promise<'proceed' | 'skip' | 'indeterminate'> {
    if (!task.expectedPreStateHash) {
      // No hash specified, proceed with execution
      return 'proceed';
    }

    // Resolve target files from writeDirectoryPaths
    const targetFiles = this.resolveTargetFiles(task, cwd);
    
    if (targetFiles.length === 0) {
      // No target files found, proceed (may be new file creation)
      return 'proceed';
    }

    // Compute current state hash
    const currentStateHash = await this.computeFilesHash(targetFiles);

    if (currentStateHash === task.expectedPreStateHash) {
      // Pre-state matches - refactoring has NOT been applied yet
      return 'proceed';
    }

    // Hash mismatch - check if refactoring is already applied via verification step
    if (task.verificationStep) {
      const verificationPassed = await this.runVerificationStep(task.verificationStep, cwd);
      if (verificationPassed) {
        // Verification passed - refactoring already applied
        return 'skip';
      }
    }

    // Cannot determine state - escalate to human
    return 'indeterminate';
  }

  /**
   * Resolve target files for a refactoring task.
   */
  private resolveTargetFiles(task: ExecutionTask, cwd: string): string[] {
    const { existsSync, readdirSync } = require('node:fs');
    const { join, resolve } = require('node:path');
    const files: string[] = [];

    for (const dirPath of task.writeDirectoryPaths) {
      const absDir = resolve(cwd, dirPath);
      if (existsSync(absDir)) {
        // Collect all files in the directory
        const collectFiles = (dir: string): void => {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              collectFiles(fullPath);
            } else if (entry.isFile()) {
              files.push(fullPath);
            }
          }
        };
        collectFiles(absDir);
      }
    }

    return files;
  }

  /**
   * Compute a combined hash of multiple files.
   */
  private async computeFilesHash(files: string[]): Promise<string> {
    const { readFileSync } = require('node:fs');
    const hashes = files
      .map(f => {
        try {
          const content = readFileSync(f, 'utf-8');
          return ExecutorAgent.computeFileHash(content);
        } catch {
          return 'FILE_NOT_FOUND';
        }
      })
      .sort(); // Sort for deterministic ordering
    
    return ExecutorAgent.computeFileHash(hashes.join('|'));
  }

  /**
   * Run a verification step to check if refactoring is already applied.
   * This is a placeholder that would integrate with the CLI agent in production.
   */
  private async runVerificationStep(verificationStep: string, _cwd: string): Promise<boolean> {
    // In production, this would invoke a quick CLI check
    // For now, return false to proceed with execution
    getLogger().info('workflow', 'Running verification step', { verificationStep });
    return false;
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
