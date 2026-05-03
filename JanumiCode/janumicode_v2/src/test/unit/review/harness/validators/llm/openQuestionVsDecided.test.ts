import { describe, it, expect } from 'vitest';
import { invokeOpenQuestionVsDecided } from '../../../../../../lib/review/harness/validators/llm/openQuestionVsDecided';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

describe('open_question_vs_decided (LLM)', () => {
  it('passes ungrounded threshold finding through', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          findings: [
            {
              severity: 'HIGH',
              type: 'ungrounded_threshold',
              summary: 's',
              location: '$.requirements[0]',
              detail: 'd',
              recommendation: 'r',
            },
          ],
        },
      }),
    );
    const findings = await invokeOpenQuestionVsDecided(
      makeRuntime(),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings[0].validatorId).toBe('open_question_vs_decided');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('returns [] when LLM reports no findings array', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { passed: true } }),
    );
    const ctx = makeContext();
    const findings = await invokeOpenQuestionVsDecided(
      makeRuntime(),
      caller,
      makeLoader(true),
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures).toEqual([]);
  });

  it('records validator_unavailable on missing template', async () => {
    const { caller } = makeLLMCaller();
    const ctx = makeContext();
    await invokeOpenQuestionVsDecided(makeRuntime(), caller, makeLoader(false), ctx);
    expect(ctx.failures[0].error).toContain('validator_unavailable');
  });
});
