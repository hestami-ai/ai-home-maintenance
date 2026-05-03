import { vi } from 'vitest';
import type {
  LLMCaller,
  LLMCallResult,
} from '../../../../../../lib/llm/llmCaller';
import type { TemplateLoader } from '../../../../../../lib/orchestrator/templateLoader';
import type { ValidatorRuntimeParams } from '../../../../../../lib/review/harness/validatorRegistry';
import type { LLMInvokeContext } from '../../../../../../lib/review/harness/validators/llm/llmValidatorRunner';

export function emptyResult(extra: Partial<LLMCallResult> = {}): LLMCallResult {
  return {
    text: '',
    parsed: null,
    thinking: '',
    toolCalls: [],
    provider: 'stub',
    model: 'stub',
    inputTokens: 0,
    outputTokens: 0,
    usedFallback: false,
    retryAttempts: 0,
    ...extra,
  };
}

export function makeLLMCaller(impl?: (opts: unknown) => Promise<LLMCallResult>): {
  caller: LLMCaller;
  callMock: ReturnType<typeof vi.fn>;
} {
  const callMock = vi.fn(impl ?? (async () => emptyResult()));
  const caller = { call: callMock } as unknown as LLMCaller;
  return { caller, callMock };
}

export function makeLoader(found: boolean = true): TemplateLoader {
  return {
    findTemplate: vi.fn(() =>
      found
        ? {
            metadata: { required_variables: [] },
            body: 'sys',
            path: 't',
          }
        : null,
    ),
    render: vi.fn(() => ({ rendered: 'sys', missing_variables: [] })),
  } as unknown as TemplateLoader;
}

export function makeRuntime(
  overrides: Partial<ValidatorRuntimeParams> = {},
): ValidatorRuntimeParams {
  return {
    agentRole: 'orchestrator',
    subPhaseId: 'intent_quality_check',
    agentOutputId: 'out-1',
    outputText: 'response',
    outputContent: { ok: true },
    outputThinking: 'thinking',
    originalPrompt: 'prompt',
    originalSystem: 'system',
    upstreamFindings: [],
    ...overrides,
  };
}

export function makeContext(): LLMInvokeContext & {
  failures: { validatorId: string; error: string }[];
} {
  const failures: { validatorId: string; error: string }[] = [];
  return {
    workflowRunId: 'wf-1',
    phaseId: '1',
    subPhaseId: 'intent_quality_check',
    pushFailure: (validatorId: string, error: string) =>
      failures.push({ validatorId, error }),
    failures,
  };
}
