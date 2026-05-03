import { describe, it, expect } from 'vitest';
import { invokeReasoningQualityValidator } from '../../../../../../lib/review/harness/validators/llm/reasoningQualityValidator';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

describe('reasoning_quality_validator (LLM)', () => {
  it('attaches the validator id to findings', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          findings: [
            {
              severity: 'LOW',
              type: 'over_cleverness',
              summary: 's',
              location: 'l',
              detail: 'd',
              recommendation: 'r',
            },
          ],
        },
      }),
    );
    const findings = await invokeReasoningQualityValidator(
      makeRuntime(),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings[0].validatorId).toBe('reasoning_quality_validator');
  });

  it('records validator_unavailable when template missing', async () => {
    const { caller } = makeLLMCaller();
    const ctx = makeContext();
    await invokeReasoningQualityValidator(makeRuntime(), caller, makeLoader(false), ctx);
    expect(ctx.failures.length).toBe(1);
  });

  it('records llm_call_failed on rejection', async () => {
    const { caller } = makeLLMCaller(async () => {
      throw new Error('x');
    });
    const ctx = makeContext();
    await invokeReasoningQualityValidator(makeRuntime(), caller, makeLoader(true), ctx);
    expect(ctx.failures.some((f) => f.error.includes('llm_call_failed'))).toBe(true);
  });
});
