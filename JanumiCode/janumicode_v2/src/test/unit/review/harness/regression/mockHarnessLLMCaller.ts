/**
 * Track D Commit 11 — mocked harness LLMCaller.
 *
 * The harness's LLM-validator runner stamps every outbound LLM call's
 * traceContext with `agentRole='harness'` and
 * `label='harness:<validator_id>'` (see llmValidatorRunner.ts). This stub
 * routes calls back to a per-validator canned response.
 *
 * Defaults: any validator without an entry in `responsesByValidator`
 * returns a clean empty findings envelope so it produces zero findings
 * but does NOT record a parse-failure (avoids cascading failures during
 * regression coverage).
 */

import { vi } from 'vitest';
import type {
  LLMCaller,
  LLMCallOptions,
  LLMCallResult,
} from '../../../../../lib/llm/llmCaller';

export interface MockHarnessLLMCallerOptions {
  /** Per-validator canned LLM JSON responses (parsed payload). */
  responsesByValidator?: Record<string, Record<string, unknown>>;
  /** Default response when no validator-specific entry is provided. */
  defaultResponse?: Record<string, unknown>;
  /** Token counts to surface on every call. */
  inputTokens?: number;
  outputTokens?: number;
}

const EMPTY_FINDINGS_ENVELOPE: Record<string, unknown> = { findings: [] };

export function makeMockHarnessLLMCaller(
  options: MockHarnessLLMCallerOptions = {},
): {
  caller: LLMCaller;
  callMock: ReturnType<typeof vi.fn>;
} {
  const responses = options.responsesByValidator ?? {};
  const defaultResponse = options.defaultResponse ?? EMPTY_FINDINGS_ENVELOPE;
  const inputTokens = options.inputTokens ?? 0;
  const outputTokens = options.outputTokens ?? 0;

  const callMock = vi.fn(async (opts: LLMCallOptions): Promise<LLMCallResult> => {
    const label = opts.traceContext?.label ?? '';
    const validatorId = label.startsWith('harness:')
      ? label.slice('harness:'.length)
      : null;
    const parsed = (validatorId && responses[validatorId]) || defaultResponse;
    return {
      text: JSON.stringify(parsed),
      parsed,
      thinking: '',
      toolCalls: [],
      provider: 'stub',
      model: 'stub',
      inputTokens,
      outputTokens,
      usedFallback: false,
      retryAttempts: 0,
    };
  });

  return {
    caller: { call: callMock } as unknown as LLMCaller,
    callMock,
  };
}

/** Build a single canned-finding response envelope for a validator. */
export function highFinding(
  type: string,
  summary: string,
  detail: string = summary,
  recommendation: string = 'Address the diagnosed defect.',
  location: string = '$',
): Record<string, unknown> {
  return {
    findings: [
      {
        severity: 'HIGH',
        type,
        summary,
        location,
        detail,
        recommendation,
      },
    ],
  };
}
