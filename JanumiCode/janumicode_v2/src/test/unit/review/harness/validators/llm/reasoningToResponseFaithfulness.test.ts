import { describe, it, expect } from 'vitest';
import { invokeReasoningToResponseFaithfulness } from '../../../../../../lib/review/harness/validators/llm/reasoningToResponseFaithfulness';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

describe('reasoning_to_response_faithfulness (LLM)', () => {
  it('invokes LLM with the right traceContext', async () => {
    const { caller, callMock } = makeLLMCaller();
    await invokeReasoningToResponseFaithfulness(
      makeRuntime(),
      caller,
      makeLoader(true),
      makeContext(),
    );
    const call = callMock.mock.calls[0][0];
    expect(call.traceContext.agentRole).toBe('harness');
    expect(call.traceContext.label).toBe('harness:reasoning_to_response_faithfulness');
    expect(call.responseFormat).toBe('json');
  });

  it('maps a faithfulness finding into the validator-id namespace', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          findings: [
            {
              severity: 'MEDIUM',
              type: 'enumerate_then_drop_unjustified',
              summary: 's',
              location: '$.userStories',
              detail: 'd',
              recommendation: 'r',
            },
          ],
        },
      }),
    );
    const findings = await invokeReasoningToResponseFaithfulness(
      makeRuntime(),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].validatorId).toBe('reasoning_to_response_faithfulness');
    expect(findings[0].type).toBe('enumerate_then_drop_unjustified');
  });

  it('records validator_unavailable when template missing', async () => {
    const { caller } = makeLLMCaller();
    const ctx = makeContext();
    const findings = await invokeReasoningToResponseFaithfulness(
      makeRuntime(),
      caller,
      makeLoader(false),
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures.length).toBe(1);
  });
});
