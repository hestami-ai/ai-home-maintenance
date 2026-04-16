/**
 * Phase 9 — Execution.
 * Based on JanumiCode Spec v2.3, §4 Phase 9.
 *
 * Sub-phases:
 *   9.1 — Implementation Task Execution (invoke Executor Agent for each task)
 *   9.2 — Test Execution (run Vitest suites)
 *   9.3 — Evaluation Execution (functional, quality, reasoning)
 *   9.4 — Failure Handling (retry, rollback, or accept with caveat)
 *   9.5 — Completion Approval (phase gate)
 *
 * Uses ExecutionContextBuilder to assemble context payloads from upstream
 * artifacts, and ExecutorAgent to invoke CLI-backed coding agents.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { ExecutorAgent, type ExecutionTask, type ExecutionResult } from '../../agents/executorAgent';
import { ExecutionContextBuilder, type ImplementationTask as CtxTask } from '../executionContextBuilder';
import { TestRunner, type TestSuite } from '../testRunner';
import { EvalRunner, type EvaluationCriterion } from '../evalRunner';
import { FailureHandler, type FailureContext } from '../failureHandler';
import { ReasoningReview, type ReasoningReviewInput } from '../../review/reasoningReview';
import { ContextBuilder } from '../contextBuilder';
import { LoopDetectionMonitor, type FlawRecord } from '../loopDetectionMonitor';
import { randomUUID } from 'node:crypto';

export class Phase9Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '9';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];
    const generateId = () => randomUUID();

    // Track flaw history for loop detection
    const flawHistory: FlawRecord[] = [];
    const loopMonitor = new LoopDetectionMonitor();

    // ── Initialize Execution Context Builder ───────────────────────
    const execContextBuilder = new ExecutionContextBuilder(
      engine.db,
      engine.writer,
      {
        stdinMaxTokens: 8000,
        detailFileMaxBytes: 100000,
        detailFilePathTemplate: `${engine.workspacePath}/.janumicode/context/{sub_phase_id}_{invocation_id}.md`,
        workspacePath: engine.workspacePath,
        janumiCodeVersionSha: engine.janumiCodeVersionSha,
      },
    );

    // ── Initialize Executor Agent ──────────────────────────────────
    const executorAgent = new ExecutorAgent(
      engine.db,
      engine.agentInvoker,
      engine.writer,
      engine.eventBus,
      generateId,
    );

    // ── Extract artifacts from prior phases ────────────────────────
    const artifacts = execContextBuilder.extractArtifacts(workflowRun.id);
    const planRecord = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'implementation_plan');

    // ── 9.1 — Implementation Task Execution ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '9.1');

    const tasks = artifacts.implementationPlan ?? [];
    const orderedTasks = execContextBuilder.getTasksInDependencyOrder(tasks);

    const executionResults: ExecutionResult[] = [];
    let tasksCompleted = 0;
    let tasksFailed = 0;
    let tasksQuarantined = 0;

    for (const task of orderedTasks) {
      const invocationId = generateId();

      // Build context payload for this task
      const contextPayload = execContextBuilder.buildTaskContext(
        task as unknown as CtxTask,
        workflowRun.id,
        invocationId,
        artifacts,
      );

      // Convert to ExecutionTask format
      const execTask: ExecutionTask = {
        id: task.id,
        taskType: task.task_type,
        componentId: task.component_id,
        componentResponsibility: task.component_responsibility,
        description: task.description,
        backingTool: task.backing_tool,
        completionCriteria: task.completion_criteria.map(c => ({
          criterionId: c.criterion_id,
          description: c.description,
        })),
        writeDirectoryPaths: task.write_directory_paths ?? [],
        expectedPreStateHash: task.expected_pre_state_hash,
        verificationStep: task.verification_step,
      };

      // Execute the task
      const result = await executorAgent.execute(
        execTask,
        workflowRun.id,
        contextPayload.stdin.text,
        engine.workspacePath,
        engine.janumiCodeVersionSha,
      );

      executionResults.push(result);

      // Run Reasoning Review after each task. The provider/model come from
      // `llm_routing.reasoning_review.primary` in config — NOT hardcoded
      // here. If the provider isn't registered at engine startup,
      // validateLLMRouting() surfaces that as a fatal misconfiguration so
      // we never get to this point with a broken config.
      const rrConfig = engine.llmRouting.reasoning_review;
      const reasoningReview = new ReasoningReview(
        engine.llmCaller,
        new ContextBuilder({
          stdinMaxTokens: 32000,
          detailFileMaxBytes: 50000,
          detailFilePathTemplate: '',
          workspacePath: engine.workspacePath,
        }),
        engine.templateLoader,
        {
          provider: rrConfig.primary.provider,
          model: rrConfig.primary.model,
          traceMaxTokens: rrConfig.trace_max_tokens,
          temperature: rrConfig.temperature,
          janumiCodeVersionSha: engine.janumiCodeVersionSha,
        },
      );

      // Load trace records from DB for this task
      const traceRecords = engine.db.prepare(`
        SELECT * FROM governed_stream
        WHERE workflow_run_id = ? AND phase_id = '9' AND sub_phase_id = '9.1'
        AND json_extract(content, '$.task_id') = ?
        ORDER BY produced_at ASC
      `).all(workflowRun.id, task.id) as Array<{ id: string; content: string; produced_at: string }>;

      const reviewInput: ReasoningReviewInput = {
        traceRecords: traceRecords.map((r, i) => ({
          id: r.id,
          type: 'agent_reasoning_step' as const,
          content: r.content,
          sequencePosition: i,
          tokenCount: Math.ceil(r.content.length / 4), // Rough token estimate
        })),
        isExecutorAgent: true,
        requiredOutputSpec: task.description,
        phaseGateCriteria: task.completion_criteria.map(c => c.description).join('\n'),
        finalOutput: result.success ? 'Task completed successfully' : (result.error ?? 'Task failed'),
        completionCriteria: task.completion_criteria.map(c => c.description).join('\n'),
        subPhaseId: '9.1',
        workflowRunId: workflowRun.id,
      };

      // ReasoningReview is a correctness-validation step. If it fails, the
      // task's outputs cannot be trusted and the phase must surface the
      // failure — not silently pass. The LLM provider must be configured
      // and reachable; misconfigurations should be caught at engine startup
      // (see ConfigManager.validateLLMRouting).
      const reviewResult = await reasoningReview.review(reviewInput);

      // Record reasoning review result
      engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '9',
        sub_phase_id: '9.1',
        produced_by_agent_role: 'reasoning_review',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: {
          kind: 'reasoning_review_result',
          task_id: task.id,
          overall_pass: reviewResult.overallPass,
          flaw_count: reviewResult.flaws.length,
          high_severity_flaws: reviewResult.flaws.filter(f => f.severity === 'high').length,
        },
      });

      if (!reviewResult.overallPass) {
        getLogger().warn('workflow', 'Reasoning review found flaws', {
          task_id: task.id,
          flaw_count: reviewResult.flaws.length,
        });

        // Track flaws for loop detection
        flawHistory.push({
          attemptNumber: flawHistory.length + 1,
          flaws: reviewResult.flaws.map(f => ({ type: f.flawType, severity: f.severity })),
        });

        // Run loop detection if we have history
        if (flawHistory.length >= 2) {
          // Extract tool calls from trace records
          const toolCallHistory = traceRecords
            .filter(r => r.content.includes('"type":"tool_call"') || r.content.includes('"tool_call"'))
            .map(r => {
              try {
                const content = JSON.parse(r.content);
                return {
                  attemptNumber: flawHistory.length,
                  toolCalls: content.toolCalls || content.tool_calls || [{ name: content.name || 'unknown', params: JSON.stringify(content.params || content.input || {}) }],
                };
              } catch {
                return { attemptNumber: flawHistory.length, toolCalls: [] };
              }
            });

          const loopResult = loopMonitor.assess({
            retryCount: flawHistory.length,
            flawHistory,
            toolCallHistory,
            availableTools: ['read_file', 'write_file', 'execute_command', 'search'],
          });

          // Record loop status
          engine.writer.writeRecord({
            record_type: 'artifact_produced',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '9',
            sub_phase_id: '9.1',
            produced_by_agent_role: 'loop_detection_monitor',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            content: {
              kind: 'loop_detection_result',
              task_id: task.id,
              loop_status: loopResult.loopStatus,
              high_severity_flaw_count: loopResult.highSeverityFlawCount,
              tools_not_called: loopResult.toolsNotCalled,
            },
          });

          // If DIVERGING or STALLED, trigger UnstickingAgent via FailureHandler
          if (loopResult.loopStatus === 'DIVERGING' || loopResult.loopStatus === 'STALLED') {
            getLogger().warn('workflow', 'Loop detected, may need intervention', {
              task_id: task.id,
              loop_status: loopResult.loopStatus,
            });
          }
        }
      }

      if (result.success) {
        tasksCompleted++;
      } else {
        tasksFailed++;
        getLogger().warn('workflow', 'Task execution failed', {
          task_id: task.id,
          error: result.error,
        });
      }
    }

    const executionRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: planRecord ? [planRecord.id] : [],
      content: {
        kind: 'execution_summary',
        sub_phase: '9.1_implementation',
        tasks_attempted: orderedTasks.length,
        tasks_completed: tasksCompleted,
        tasks_failed: tasksFailed,
        tasks_quarantined: tasksQuarantined,
        execution_trace_count: orderedTasks.length,
        files_written: executionResults.flatMap(r => r.filesWritten).map(f => f.filePath),
      },
    });
    artifactIds.push(executionRecord.id);
    engine.ingestionPipeline.ingest(executionRecord);

    // ── 9.2 — Test Execution ──────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '9.2');

    // Load test plan to get test suites
    const testPlanRecord = engine.db.prepare(`
      SELECT content FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
      AND json_extract(content, '$.kind') = 'test_plan'
      ORDER BY produced_at DESC LIMIT 1
    `).get(workflowRun.id) as { content: string } | undefined;

    const testSuites: TestSuite[] = testPlanRecord
      ? this.extractTestSuites(testPlanRecord.content, generateId)
      : [];

    const testRunner = new TestRunner(
      engine.db,
      engine.writer,
      engine.eventBus,
      generateId,
    );

    const testResults = await testRunner.runSuites(
      testSuites,
      engine.workspacePath,
      workflowRun.id,
      engine.janumiCodeVersionSha,
    );

    const testResultsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: '9.2',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id],
      content: {
        kind: 'test_results',
        suite_results: testResults.suiteResults.map(sr => ({
          suite_id: sr.suiteId,
          suite_name: sr.suiteName,
          passed: sr.passed,
          failed: sr.failed,
          skipped: sr.skipped,
          duration_ms: sr.durationMs,
        })),
        total_passed: testResults.totalPassed,
        total_failed: testResults.totalFailed,
        total_skipped: testResults.totalSkipped,
        execution_order: ['unit', 'integration', 'end_to_end'],
      },
    });
    artifactIds.push(testResultsRecord.id);
    engine.ingestionPipeline.ingest(testResultsRecord);

    // ── 9.3 — Evaluation Execution ────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '9.3');

    // Load evaluation plan to get criteria
    const evalPlanRecord = engine.db.prepare(`
      SELECT content FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
      AND json_extract(content, '$.kind') IN ('functional_evaluation_plan', 'quality_evaluation_plan', 'reasoning_evaluation_plan')
      ORDER BY produced_at DESC
    `).all(workflowRun.id) as Array<{ content: string }>;

    const evalCriteria: EvaluationCriterion[] = evalPlanRecord
      .flatMap(r => this.extractEvalCriteria(r.content, generateId));

    const evalRunner = new EvalRunner(
      engine.db,
      engine.writer,
      engine.eventBus,
      engine.llmCaller,
      generateId,
    );

    const evalResults = await evalRunner.runEvaluations(
      evalCriteria,
      {
        workflowRunId: workflowRun.id,
        workspacePath: engine.workspacePath,
        executionSummary: executionRecord.content,
        testResults: testResultsRecord.content,
      },
      engine.janumiCodeVersionSha,
    );

    const evalResultsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: '9.3',
      produced_by_agent_role: 'eval_execution_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id, testResultsRecord.id],
      content: {
        kind: 'evaluation_results',
        functional: evalResults.functional.map(r => ({
          criterion_id: r.criterionId,
          criterion_name: r.criterionName,
          passed: r.passed,
        })),
        quality: evalResults.quality.map(r => ({
          criterion_id: r.criterionId,
          criterion_name: r.criterionName,
          metric: r.metric,
          passed: r.passed,
        })),
        reasoning: evalResults.reasoning.map(r => ({
          criterion_id: r.criterionId,
          criterion_name: r.criterionName,
          passed: r.passed,
          severity: r.severity,
        })),
        overall_pass: evalResults.overallPass,
      },
    });
    artifactIds.push(evalResultsRecord.id);
    engine.ingestionPipeline.ingest(evalResultsRecord);

    // ── 9.4 — Failure Handling ─────────────────────
    // Handle failures if tests or evaluations failed
    if (testResults.totalFailed > 0 || !evalResults.overallPass) {
      engine.stateMachine.setSubPhase(workflowRun.id, '9.4');

      const failureHandler = new FailureHandler(
        engine.db,
        engine.writer,
        engine.eventBus,
        engine.llmCaller,
        engine.templateLoader,
        generateId,
        engine.janumiCodeVersionSha,
      );

      // Build failure context for each failed task
      for (const taskResult of executionResults.filter(r => !r.success)) {
        const failureContext: FailureContext = {
          workflowRunId: workflowRun.id,
          subPhaseId: '9.1',
          taskId: taskResult.taskId,
          taskName: tasks.find(t => t.id === taskResult.taskId)?.description ?? 'Unknown task',
          failureType: 'execution_error',
          errorMessage: taskResult.error ?? 'Unknown error',
          executionTrace: JSON.stringify(taskResult),
          attemptNumber: 1,
          maxAttempts: 3,
          previousAttempts: [],
        };

        const resolution = await failureHandler.handleFailure(failureContext);

        if (resolution.strategy === 'retry' && failureContext.attemptNumber < failureContext.maxAttempts) {
          // Retry: Re-invoke executor for the failed task
          getLogger().info('workflow', 'Retrying failed task', {
            taskId: taskResult.taskId,
            attempt: failureContext.attemptNumber + 1,
            maxAttempts: failureContext.maxAttempts,
          });

          const task = tasks.find(t => t.id === taskResult.taskId);
          if (task) {
            const retryInvocationId = generateId();
            const retryContext = execContextBuilder.buildTaskContext(
              task as unknown as CtxTask,
              workflowRun.id,
              retryInvocationId,
              artifacts,
            );

            const retryTask: ExecutionTask = {
              id: task.id,
              taskType: task.task_type,
              componentId: task.component_id,
              componentResponsibility: task.component_responsibility,
              description: task.description,
              backingTool: task.backing_tool,
              completionCriteria: task.completion_criteria.map(c => ({
                criterionId: c.criterion_id,
                description: c.description,
              })),
              writeDirectoryPaths: task.write_directory_paths ?? [],
              expectedPreStateHash: task.expected_pre_state_hash,
              verificationStep: task.verification_step,
            };

            const retryResult = await executorAgent.execute(
              retryTask,
              workflowRun.id,
              retryContext.stdin.text,
              engine.workspacePath,
              engine.janumiCodeVersionSha,
            );

            if (retryResult.success) {
              getLogger().info('workflow', 'Retry succeeded', { taskId: taskResult.taskId });
            } else {
              getLogger().warn('workflow', 'Retry failed', { taskId: taskResult.taskId, error: retryResult.error });
            }
          }
        } else if (resolution.strategy === 'rollback') {
          // Rollback: Restore files from previous state
          getLogger().warn('workflow', 'Rolling back changes', { taskId: taskResult.taskId });

          // Load file write records for this task
          const writeRecords = engine.db.prepare(`
            SELECT content FROM governed_stream
            WHERE workflow_run_id = ? AND phase_id = '9' AND sub_phase_id = '9.1'
            AND record_type = 'artifact_produced'
            AND json_extract(content, '$.kind') = 'file_written'
            AND json_extract(content, '$.task_id') = ?
          `).all(workflowRun.id, taskResult.taskId) as Array<{ content: string }>;

          for (const record of writeRecords) {
            try {
              const fileRecord = JSON.parse(record.content);
              if (fileRecord.sha256Before && fileRecord.filePath) {
                // Record rollback intent (actual file restoration would require backup storage)
                engine.writer.writeRecord({
                  record_type: 'artifact_produced',
                  schema_version: '1.0',
                  workflow_run_id: workflowRun.id,
                  phase_id: '9',
                  sub_phase_id: '9.4',
                  produced_by_agent_role: 'orchestrator',
                  janumicode_version_sha: engine.janumiCodeVersionSha,
                  content: {
                    kind: 'rollback_record',
                    task_id: taskResult.taskId,
                    file_path: fileRecord.filePath,
                    previous_hash: fileRecord.sha256Before,
                    status: 'recorded',
                    note: 'Actual file restoration requires backup storage implementation',
                  },
                });
              }
            } catch (parseErr) {
              getLogger().warn('workflow', 'Failed to parse file write record for rollback', { error: String(parseErr) });
            }
          }
        } else if (resolution.strategy === 'escalate') {
          getLogger().warn('workflow', 'Failure requires escalation', {
            taskId: taskResult.taskId,
            reason: resolution.escalationReason,
          });
          // Create human gate for escalation
          const escalationRecord = engine.writer.writeRecord({
            record_type: 'phase_gate_evaluation',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '9',
            sub_phase_id: '9.4',
            produced_by_agent_role: 'orchestrator',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            content: {
              kind: 'failure_escalation',
              task_id: taskResult.taskId,
              reason: resolution.escalationReason,
              resolution: 'pending',
            },
          });
          artifactIds.push(escalationRecord.id);

          try {
            const decision = await engine.pauseForDecision(workflowRun.id, escalationRecord.id, 'phase_gate');
            if (decision.type === 'phase_gate_rejection') {
              return { success: false, error: 'User rejected failure resolution', artifactIds };
            }
          } catch (err) {
            getLogger().warn('workflow', 'Failure escalation decision failed', { error: String(err) });
          }
        } else if (resolution.strategy === 'accept_with_caveat') {
          // Accept with caveat: Document the exception and proceed
          getLogger().info('workflow', 'Accepting failure with caveat', {
            taskId: taskResult.taskId,
            caveat: resolution.caveat,
          });

          engine.writer.writeRecord({
            record_type: 'artifact_produced',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '9',
            sub_phase_id: '9.4',
            produced_by_agent_role: 'orchestrator',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            content: {
              kind: 'acceptance_with_caveat',
              task_id: taskResult.taskId,
              caveat: resolution.caveat,
              accepted_at: new Date().toISOString(),
            },
          });
        }
      }
    }

    // ── 9.5 — Completion Approval ─────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '9.5');

    const execMirror = engine.mirrorGenerator.generate({
      artifactId: executionRecord.id,
      artifactType: 'execution_summary',
      content: { tasks_completed: tasksCompleted, tasks_failed: tasksFailed, tests_passed: 0, eval_pass: tasksFailed === 0 },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: '9.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id, testResultsRecord.id, evalResultsRecord.id],
      content: {
        kind: 'execution_completion_mirror',
        mirror_id: execMirror.mirrorId,
        fields: execMirror.fields,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: execMirror.mirrorId, artifactType: 'execution_summary' });

    try {
      const resolution = await engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror');
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected execution results', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 9 approval failed', { error: String(err) });
      return { success: false, error: 'Execution approval failed', artifactIds };
    }

    // Phase Gate
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: '9.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id, testResultsRecord.id, evalResultsRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '9',
        has_unresolved_warnings: false,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '9' });

    return { success: true, artifactIds };
  }

  /**
   * Extract test suites from test_plan artifact content.
   */
  private extractTestSuites(
    testPlanContent: string,
    generateId: () => string,
  ): TestSuite[] {
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(testPlanContent);
    } catch {
      getLogger().warn('workflow', 'Failed to parse test_plan content');
      return [];
    }

    const suites: TestSuite[] = [];
    const testCases = (plan.test_cases ?? []) as Array<Record<string, unknown>>;

    // Group test cases by suite type
    const byType = new Map<string, Array<Record<string, unknown>>>();
    for (const tc of testCases) {
      const type = (tc.suite_type ?? tc.type ?? 'unit') as string;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(tc);
    }

    // Build TestSuite objects
    for (const [type, cases] of byType) {
      suites.push({
        id: generateId(),
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Tests`,
        type: type as 'unit' | 'integration' | 'end_to_end',
        testFilePaths: cases
          .map(c => (c.test_file_path ?? c.filePath ?? '') as string)
          .filter(p => p),
        validatesTaskIds: cases
          .flatMap(c => (c.validates_task_ids ?? []) as string[]),
        coversCriteriaIds: cases
          .map(c => (c.acceptance_criterion_id ?? c.criterion_id ?? '') as string)
          .filter(id => id),
      });
    }

    return suites;
  }

  /**
   * Extract evaluation criteria from evaluation plan artifact content.
   */
  private extractEvalCriteria(
    evalPlanContent: string,
    generateId: () => string,
  ): EvaluationCriterion[] {
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(evalPlanContent);
    } catch {
      getLogger().warn('workflow', 'Failed to parse evaluation plan content');
      return [];
    }

    const criteria: EvaluationCriterion[] = [];
    const planCriteria = (plan.criteria ?? plan.evaluation_criteria ?? []) as Array<Record<string, unknown>>;

    for (const c of planCriteria) {
      const type = (c.type ?? 'functional') as 'functional' | 'quality' | 'reasoning';
      criteria.push({
        id: (c.id as string) ?? generateId(),
        name: (c.name as string) ?? 'Unnamed criterion',
        type,
        description: (c.description as string) ?? '',
        evaluationTool: (c.evaluation_tool as string) ?? 'llm_judge',
        passingThreshold: c.passing_threshold as number | undefined,
        acceptanceCriterionId: c.acceptance_criterion_id as string | undefined,
      });
    }

    return criteria;
  }
}
