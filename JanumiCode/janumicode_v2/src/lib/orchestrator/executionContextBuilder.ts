/**
 * Execution Context Builder - builds context payloads for Phase 9 execution tasks.
 * Based on JanumiCode Spec v2.3, §4 Phase 9 and §7.2-7.3.
 *
 * Assembles execution-specific context from:
 *   - Implementation Plan (Phase 6)
 *   - Test Plan (Phase 7)
 *   - Evaluation Plans (Phase 8)
 *   - Component Model (Phase 4)
 *   - Technical Specs (Phase 5)
 *   - Architectural Decisions (Phase 4)
 */

import { ContextBuilder, type StdinContent, type DetailFileContent, type ContextPayload } from './contextBuilder';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { Database } from '../database/init';

// Re-export types from contextBuilder for convenience
export type { StdinContent, DetailFileContent, ContextPayload };

// Execution-specific types

export interface ImplementationTask {
  id: string;
  task_type: 'standard' | 'refactoring';
  component_id: string;
  component_responsibility: string;
  description: string;
  technical_spec_ids?: string[];
  backing_tool: string;
  dependency_task_ids?: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  complexity_flag?: string;
  completion_criteria: CompletionCriterion[];
  write_directory_paths?: string[];
  read_directory_paths?: string[];
  // Refactoring task fields
  expected_pre_state_hash?: string;
  verification_step?: string;
}

export interface CompletionCriterion {
  criterion_id: string;
  description: string;
  verification_method: 'schema_check' | 'invariant' | 'output_comparison' | 'test_execution';
  artifact_ref?: string;
}

export interface TestCase {
  test_case_id: string;
  type: 'unit' | 'integration' | 'end_to_end';
  acceptance_criterion_ids: string[];
  component_ids?: string[];
  preconditions: string[];
  inputs?: Record<string, unknown>;
  execution_steps?: string[];
  expected_outcome: string;
  edge_cases?: string[];
  implementation_notes?: string;
}

export interface TestSuite {
  suite_id: string;
  component_id: string;
  test_type: 'unit' | 'integration' | 'end_to_end';
  runner_command?: string;
  test_cases: TestCase[];
}

export interface TestPlan {
  test_suites: TestSuite[];
  total_test_cases?: number;
  coverage_by_type?: { unit: number; integration: number; end_to_end: number };
}

export interface FunctionalEvalCriterion {
  functional_requirement_id: string;
  evaluation_method: string;
  success_condition: string;
}

export interface QualityEvalCriterion {
  nfr_id: string;
  category: string;
  evaluation_tool: string;
  threshold: string;
  measurement_method: string;
  fallback_if_tool_unavailable?: string;
}

export interface ReasoningScenario {
  id: string;
  description: string;
  pass_criteria: string;
}

export interface EvaluationPlans {
  functional?: { criteria: FunctionalEvalCriterion[] };
  quality?: { criteria: QualityEvalCriterion[] };
  reasoning?: { scenarios: ReasoningScenario[]; ai_subsystems_detected: boolean };
}

export interface ExecutionContextOptions {
  /** Maximum tokens for stdin directive */
  stdinMaxTokens: number;
  /** Maximum bytes for detail file */
  detailFileMaxBytes: number;
  /** Path template for detail files */
  detailFilePathTemplate: string;
  /** Workspace root path */
  workspacePath: string;
  /** JanumiCode version SHA */
  janumiCodeVersionSha: string;
}

// Artifact content types for extraction

interface ArtifactContent {
  kind: string;
  [key: string]: unknown;
}

// Helper to format completion criteria for context

function formatCompletionCriteria(criteria: CompletionCriterion[]): string {
  return criteria.map((c, i) => {
    const verification = c.artifact_ref 
      ? `${c.verification_method} (ref: ${c.artifact_ref})`
      : c.verification_method;
    return `${i + 1}. [${c.criterion_id}] ${c.description}\n   Verification: ${verification}`;
  }).join('\n');
}

// Helper to format test cases for a component

function formatTestCasesForComponent(testPlan: TestPlan | null, componentId: string): string {
  if (!testPlan) return 'No test plan available';
  
  const relevantSuites = testPlan.test_suites.filter(s => s.component_id === componentId);
  if (relevantSuites.length === 0) return `No test suites for component ${componentId}`;
  
  return relevantSuites.map(suite => {
    const cases = suite.test_cases.map(tc => 
      `- [${tc.test_case_id}] (${tc.type}) ${tc.expected_outcome}`
    ).join('\n');
    return `### Test Suite: ${suite.suite_id}\nType: ${suite.test_type}\n${cases}`;
  }).join('\n\n');
}

// Helper to format evaluation criteria

function formatEvaluationCriteria(plans: EvaluationPlans): string {
  const sections: string[] = [];
  
  if (plans.functional?.criteria.length) {
    sections.push('## Functional Evaluation Criteria\n' + 
      plans.functional.criteria.map(c => 
        `- [${c.functional_requirement_id}] ${c.evaluation_method}: ${c.success_condition}`
      ).join('\n')
    );
  }
  
  if (plans.quality?.criteria.length) {
    sections.push('## Quality Evaluation Criteria\n' + 
      plans.quality.criteria.map(c => 
        `- [${c.nfr_id}] ${c.category}: ${c.threshold} via ${c.evaluation_tool}`
      ).join('\n')
    );
  }
  
  if (plans.reasoning?.scenarios.length) {
    sections.push('## Reasoning Evaluation Scenarios\n' + 
      plans.reasoning.scenarios.map(s => 
        `- [${s.id}] ${s.description} (pass: ${s.pass_criteria})`
      ).join('\n')
    );
  }
  
  return sections.join('\n\n') || 'No evaluation criteria specified';
}

// Helper to format ADRs

function formatADRs(adrs: Array<{ id: string; title: string; decision: string }>): string {
  if (!adrs.length) return 'No architectural decisions recorded';
  return adrs.map(adr => `### ${adr.id}: ${adr.title}\n${adr.decision}`).join('\n\n');
}

/**
 * Execution Context Builder
 * 
 * Builds context payloads specifically for Phase 9 implementation tasks.
 * Uses the base ContextBuilder for two-channel payload construction.
 */
export class ExecutionContextBuilder {
  private readonly baseBuilder: ContextBuilder;

  constructor(
    private readonly db: Database,
    private readonly writer: GovernedStreamWriter,
    private readonly options: ExecutionContextOptions,
  ) {
    this.baseBuilder = new ContextBuilder({
      stdinMaxTokens: options.stdinMaxTokens,
      detailFileMaxBytes: options.detailFileMaxBytes,
      detailFilePathTemplate: options.detailFilePathTemplate,
      workspacePath: options.workspacePath,
    });
  }

  /**
   * Build execution context for a single implementation task.
   */
  buildTaskContext(
    task: ImplementationTask,
    workflowRunId: string,
    invocationId: string,
    artifacts: {
      implementationPlan: ImplementationTask[] | null;
      testPlan: TestPlan | null;
      evaluationPlans: EvaluationPlans;
      componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null;
      technicalSpecs: Array<{ component_id: string; content: string }> | null;
      adrs: Array<{ id: string; title: string; decision: string }>;
    },
    retryContext?: {
      invariantViolations?: string;
      reasoningReviewFindings?: string;
    },
  ): ContextPayload {
    // Build stdin content
    const stdinContent: StdinContent = {
      governingConstraints: this.buildGoverningConstraints(task, artifacts.adrs),
      requiredOutputSpec: this.buildRequiredOutputSpec(task),
      summaryContext: this.buildSummaryContext(task, artifacts),
      detailFileReference: `Full context available in detail file at .janumicode/context/9.1_${invocationId}.md`,
      invariantViolations: retryContext?.invariantViolations,
      reasoningReviewFindings: retryContext?.reasoningReviewFindings,
    };

    // Build detail file content
    const detailContent: DetailFileContent = {
      contextPacket: JSON.stringify({
        task,
        component: artifacts.componentModel?.components.find(c => c.id === task.component_id),
        test_cases: artifacts.testPlan?.test_suites
          .filter(s => s.component_id === task.component_id)
          .flatMap(s => s.test_cases),
        evaluation_criteria: artifacts.evaluationPlans,
      }, null, 2),
      technicalSpecs: artifacts.technicalSpecs?.filter(s => 
        task.technical_spec_ids?.includes(s.component_id) || s.component_id === task.component_id
      ).map(s => ({ componentId: s.component_id, content: s.content })),
      decisionTraces: formatADRs(artifacts.adrs),
    };

    return this.baseBuilder.buildContextPayload(
      `9.1_${task.id}`,
      invocationId,
      stdinContent,
      detailContent,
    );
  }

  /**
   * Build governing constraints for an implementation task.
   * These are Authority Level 6+ and must NEVER be truncated.
   */
  private buildGoverningConstraints(
    task: ImplementationTask,
    adrs: Array<{ id: string; title: string; decision: string }>,
  ): string {
    const sections: string[] = [];

    // Task identity
    sections.push(
      `## Implementation Task: ${task.id}\n` +
      `Component: ${task.component_id}\n` +
      `Responsibility: ${task.component_responsibility}\n` +
      `Type: ${task.task_type}`
    );

    // Completion criteria (inviolable)
    sections.push(
      `## Completion Criteria (MUST satisfy all)\n` +
      formatCompletionCriteria(task.completion_criteria)
    );

    // Write scope constraints
    if (task.write_directory_paths?.length) {
      sections.push(
        `## Write Scope Constraint\n` +
        `Files may ONLY be created/modified in:\n` +
        task.write_directory_paths.map(p => `- ${p}`).join('\n')
      );
    }

    // Relevant ADRs
    if (adrs.length > 0) {
      sections.push(
        `## Governing Architectural Decisions\n` +
        formatADRs(adrs)
      );
    }

    // Refactoring task constraints
    if (task.task_type === 'refactoring' && task.expected_pre_state_hash) {
      sections.push(
        `## Refactoring Idempotency Constraint\n` +
        `Expected pre-state hash: ${task.expected_pre_state_hash}\n` +
        `Verification step: ${task.verification_step ?? 'Not specified'}\n` +
        `If hash matches, task is already applied. Skip and report.`
      );
    }

    return sections.join('\n\n');
  }

  /**
   * Build the required output specification.
   */
  private buildRequiredOutputSpec(task: ImplementationTask): string {
    return `## Required Output\n\n` +
      `Implement the following task:\n\n${task.description}\n\n` +
      `### Deliverables\n` +
      `1. Implementation artifacts (source files, configurations)\n` +
      `2. Test code implementing the test cases for this component\n` +
      `3. All completion criteria must be verifiable\n\n` +
      `### Constraints\n` +
      `- Do NOT modify files outside write_directory_paths\n` +
      `- Follow all governing ADRs\n` +
      `- Implement test cases before application code where possible`;
  }

  /**
   * Build summary context for the task.
   */
  private buildSummaryContext(
    task: ImplementationTask,
    artifacts: {
      implementationPlan: ImplementationTask[] | null;
      testPlan: TestPlan | null;
      evaluationPlans: EvaluationPlans;
      componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null;
      technicalSpecs: Array<{ component_id: string; content: string }> | null;
      adrs: Array<{ id: string; title: string; decision: string }>;
    },
  ): string {
    const sections: string[] = [];

    // Component context
    if (artifacts.componentModel) {
      const component = artifacts.componentModel.components.find(c => c.id === task.component_id);
      if (component) {
        sections.push(
          `## Component Context\n` +
          `Name: ${component.name}\n` +
          `Responsibility: ${component.responsibility}`
        );
      }
      sections.push(`\n### Component Model Summary\n${artifacts.componentModel.summary}`);
    }

    // Test cases for this component
    sections.push(
      `## Test Cases to Implement\n` +
      formatTestCasesForComponent(artifacts.testPlan, task.component_id)
    );

    // Evaluation criteria
    sections.push(
      `## Evaluation Criteria\n` +
      formatEvaluationCriteria(artifacts.evaluationPlans)
    );

    // Dependency tasks
    if (task.dependency_task_ids?.length && artifacts.implementationPlan) {
      const deps = artifacts.implementationPlan.filter(t => 
        task.dependency_task_ids?.includes(t.id)
      );
      if (deps.length > 0) {
        sections.push(
          `## Dependency Tasks (already completed)\n` +
          deps.map(d => `- [${d.id}] ${d.description}`).join('\n')
        );
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Extract artifacts from the Governed Stream for a workflow run.
   */
  extractArtifacts(workflowRunId: string): {
    implementationPlan: ImplementationTask[] | null;
    testPlan: TestPlan | null;
    evaluationPlans: EvaluationPlans;
    componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null;
    technicalSpecs: Array<{ component_id: string; content: string }> | null;
    adrs: Array<{ id: string; title: string; decision: string }>;
  } {
    const records = this.writer.getRecordsByType(workflowRunId, 'artifact_produced');
    
    let implementationPlan: ImplementationTask[] | null = null;
    let testPlan: TestPlan | null = null;
    const evaluationPlans: EvaluationPlans = {};
    let componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null = null;
    let technicalSpecs: Array<{ component_id: string; content: string }> | null = null;
    const adrs: Array<{ id: string; title: string; decision: string }> = [];

    for (const record of records) {
      const content = record.content as ArtifactContent;
      
      switch (content.kind) {
        case 'implementation_plan':
          implementationPlan = (content.tasks as ImplementationTask[]) ?? null;
          break;
        case 'test_plan':
          testPlan = content as unknown as TestPlan;
          break;
        case 'functional_evaluation_plan':
          evaluationPlans.functional = content as unknown as { criteria: FunctionalEvalCriterion[] };
          break;
        case 'quality_evaluation_plan':
          evaluationPlans.quality = content as unknown as { criteria: QualityEvalCriterion[] };
          break;
        case 'reasoning_evaluation_plan':
          evaluationPlans.reasoning = content as unknown as { scenarios: ReasoningScenario[]; ai_subsystems_detected: boolean };
          break;
        case 'component_model':
          componentModel = {
            summary: (content.summary as string) ?? '',
            components: (content.components as Array<{ id: string; name: string; responsibility: string }>) ?? [],
          };
          break;
        case 'technical_spec':
          technicalSpecs = [
            ...(technicalSpecs ?? []),
            {
              component_id: (content.component_id as string) ?? '',
              content: JSON.stringify(content, null, 2),
            },
          ];
          break;
        case 'adr':
          adrs.push({
            id: (content.id as string) ?? record.id,
            title: (content.title as string) ?? '',
            decision: (content.decision as string) ?? JSON.stringify(content, null, 2),
          });
          break;
      }
    }

    return {
      implementationPlan,
      testPlan,
      evaluationPlans,
      componentModel,
      technicalSpecs,
      adrs,
    };
  }

  /**
   * Get tasks in dependency order.
   */
  getTasksInDependencyOrder(tasks: ImplementationTask[]): ImplementationTask[] {
    const result: ImplementationTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: ImplementationTask) => {
      if (visited.has(task.id)) return;
      if (visiting.has(task.id)) {
        // Circular dependency - should not happen, but handle gracefully
        throw new Error(`Circular dependency detected in task ${task.id}`);
      }

      visiting.add(task.id);

      // Visit dependencies first
      if (task.dependency_task_ids?.length) {
        for (const depId of task.dependency_task_ids) {
          const dep = tasks.find(t => t.id === depId);
          if (dep) visit(dep);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      result.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return result;
  }
}
