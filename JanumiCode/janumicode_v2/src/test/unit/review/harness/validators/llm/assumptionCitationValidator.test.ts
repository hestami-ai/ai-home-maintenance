import { describe, it, expect } from 'vitest';
import { invokeAssumptionCitationValidator } from '../../../../../../lib/review/harness/validators/llm/assumptionCitationValidator';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

describe('assumption_citation_validator (LLM)', () => {
  it('returns mapped findings', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          findings: [
            {
              severity: 'MEDIUM',
              type: 'missing_rationale',
              summary: 's',
              location: 'l',
              detail: 'd',
              recommendation: 'r',
            },
          ],
        },
      }),
    );
    const findings = await invokeAssumptionCitationValidator(
      makeRuntime(),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings[0].validatorId).toBe('assumption_citation_validator');
    expect(findings[0].severity).toBe('MEDIUM');
  });

  it('records validator_unavailable when template missing', async () => {
    const { caller } = makeLLMCaller();
    const ctx = makeContext();
    await invokeAssumptionCitationValidator(
      makeRuntime(),
      caller,
      makeLoader(false),
      ctx,
    );
    expect(ctx.failures[0].error).toContain('validator_unavailable');
  });

  it('records llm_call_failed and does not throw', async () => {
    const { caller } = makeLLMCaller(async () => {
      throw new Error('boom');
    });
    const ctx = makeContext();
    const findings = await invokeAssumptionCitationValidator(
      makeRuntime(),
      caller,
      makeLoader(true),
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures.some((f) => f.error.includes('llm_call_failed'))).toBe(true);
  });
});
