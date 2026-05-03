/**
 * Track D Commit 11 — regression-corpus shared runner.
 *
 * Glue between {loadSample, mockHarnessLLMCaller, runReviewHarness}. Each
 * per-sample test calls `runRegressionSample(...)` with a small expectation
 * descriptor; this module assembles the captured quadruple, drives the
 * harness, and returns the outcome + reconstructed records for assertion.
 */

import { vi } from 'vitest';
import { runReviewHarness } from '../../../../../lib/review/harness/reviewHarness';
import type {
  ReviewHarnessOutcome,
} from '../../../../../lib/review/harness/reviewHarness';
import type { ValidatorFinding } from '../../../../../lib/review/harness/validatorRegistry';
import type {
  LLMCallResult,
  LLMTraceContext,
} from '../../../../../lib/llm/llmCaller';
import type { GovernedStreamWriter } from '../../../../../lib/orchestrator/governedStreamWriter';
import type { TemplateLoader } from '../../../../../lib/orchestrator/templateLoader';
import type {
  GovernedStreamRecord,
  ReasoningReviewHarnessRecordContent,
  ReasoningReviewFindingRecordContent,
} from '../../../../../lib/types/records';

import { loadSample, type LoadedSample } from './loadSample';
import {
  makeMockHarnessLLMCaller,
  type MockHarnessLLMCallerOptions,
} from './mockHarnessLLMCaller';

interface WrittenRecord {
  id: string;
  options: Parameters<GovernedStreamWriter['writeRecord']>[0];
}

function makeInMemoryWriter(): {
  writer: GovernedStreamWriter;
  written: WrittenRecord[];
  superseded: { recordId: string; supersededById: string }[];
} {
  const written: WrittenRecord[] = [];
  const superseded: { recordId: string; supersededById: string }[] = [];
  let counter = 0;
  const writer = {
    writeRecord: (options: Parameters<GovernedStreamWriter['writeRecord']>[0]) => {
      const id = `rec-${++counter}`;
      written.push({ id, options });
      return { id, ...options } as unknown as GovernedStreamRecord;
    },
    supersedByRollback: (recordId: string, supersededById: string) => {
      superseded.push({ recordId, supersededById });
    },
  } as unknown as GovernedStreamWriter;
  return { writer, written, superseded };
}

function makeStubTemplateLoader(): TemplateLoader {
  // Return a synthetic template for any (role, sub_phase) pair so every
  // LLM-validator's invoke path executes against the mocked LLMCaller.
  return {
    findTemplate: vi.fn(() => ({
      metadata: { required_variables: [] },
      body: 'sys',
      path: 't',
    })),
    render: vi.fn(() => ({ rendered: 'sys', missing_variables: [] })),
  } as unknown as TemplateLoader;
}

export interface RegressionRunOptions {
  sampleId: string;
  /** Optional payload override (e.g., normalized field names). */
  responseParsedOverride?: Record<string, unknown> | null;
  /** Per-validator canned LLM responses. */
  mockedLLMResponses?: MockHarnessLLMCallerOptions['responsesByValidator'];
  /**
   * Optional override of the agent_role used to dispatch validators.
   * Defaults to the sample's filename-encoded role.
   */
  agentRoleOverride?: string;
  /** Optional override of the sub_phase used to dispatch. */
  subPhaseIdOverride?: string;
}

export interface RegressionRunResult {
  sample: LoadedSample;
  outcome: ReviewHarnessOutcome;
  /** The completed harness record (status='completed'). */
  completedHarnessContent: ReasoningReviewHarnessRecordContent;
  /** All finding-record contents written by the harness. */
  findingContents: ReasoningReviewFindingRecordContent[];
  written: WrittenRecord[];
}

export async function runRegressionSample(
  options: RegressionRunOptions,
): Promise<RegressionRunResult> {
  const sample = loadSample(options.sampleId);
  const role = options.agentRoleOverride ?? sample.agentRole;
  const subPhase = options.subPhaseIdOverride ?? sample.subPhaseId;

  const writerCtx = makeInMemoryWriter();
  const { caller } = makeMockHarnessLLMCaller({
    responsesByValidator: options.mockedLLMResponses,
  });
  const templateLoader = makeStubTemplateLoader();

  const parsed =
    options.responseParsedOverride !== undefined
      ? options.responseParsedOverride
      : sample.responseParsed;

  const result: LLMCallResult = {
    text: sample.response,
    parsed,
    thinking: sample.thinking,
    toolCalls: [],
    provider: 'captured',
    model: 'captured',
    inputTokens: 0,
    outputTokens: 0,
    usedFallback: false,
    retryAttempts: 0,
  };

  const traceContext: LLMTraceContext = {
    workflowRunId: `wf-regression-${options.sampleId}`,
    phaseId: '1',
    subPhaseId: subPhase,
    agentRole: role as LLMTraceContext['agentRole'],
    label: `regression:${options.sampleId}`,
  };

  const outcome = await runReviewHarness(
    {
      agentInvocationId: `inv-${options.sampleId}`,
      agentOutputId: `out-${options.sampleId}`,
      traceContext,
      prompt: sample.prompt,
      result,
    },
    caller,
    writerCtx.writer,
    'sha-regression',
    templateLoader,
  );

  const harnessContents = writerCtx.written
    .filter((r) => r.options.record_type === 'reasoning_review_harness_record')
    .map((r) => r.options.content as unknown as ReasoningReviewHarnessRecordContent);

  const completed = harnessContents.find((c) => c.status === 'completed');
  if (!completed) {
    throw new Error(
      `Sample ${options.sampleId}: no completed harness record was written`,
    );
  }

  const findingContents = writerCtx.written
    .filter((r) => r.options.record_type === 'reasoning_review_finding_record')
    .map(
      (r) => r.options.content as unknown as ReasoningReviewFindingRecordContent,
    );

  return {
    sample,
    outcome,
    completedHarnessContent: completed,
    findingContents,
    written: writerCtx.written,
  };
}

/** Convenience: collect findings (as ValidatorFinding shape) by validator id. */
export function findingsByValidator(
  findings: readonly ValidatorFinding[],
): Record<string, ValidatorFinding[]> {
  const byId: Record<string, ValidatorFinding[]> = {};
  for (const f of findings) {
    (byId[f.validatorId] ??= []).push(f);
  }
  return byId;
}
