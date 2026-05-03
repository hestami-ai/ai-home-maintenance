import { describe, it, expect } from 'vitest';
import { invokeGroundingValidator } from '../../../../../../lib/review/harness/validators/llm/groundingValidator';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

describe('grounding_validator (LLM)', () => {
  it('loads its template and stamps the harness traceContext', async () => {
    const { caller, callMock } = makeLLMCaller();
    const loader = makeLoader(true);
    const ctx = makeContext();
    await invokeGroundingValidator(makeRuntime(), caller, loader, ctx);
    expect(loader.findTemplate).toHaveBeenCalledWith('harness', 'grounding_validator');
    const call = callMock.mock.calls[0][0];
    expect(call.responseFormat).toBe('json');
    expect(call.traceContext.agentRole).toBe('harness');
    expect(call.traceContext.label).toBe('harness:grounding_validator');
  });

  it('maps LLM findings to ValidatorFinding[]', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          findings: [
            {
              severity: 'HIGH',
              type: 'unsupported_threshold',
              summary: 's',
              location: 'l',
              detail: 'd',
              recommendation: 'r',
            },
          ],
        },
      }),
    );
    const findings = await invokeGroundingValidator(
      makeRuntime(),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].validatorId).toBe('grounding_validator');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('records validator_unavailable when prompt template is missing', async () => {
    const { caller } = makeLLMCaller();
    const ctx = makeContext();
    const findings = await invokeGroundingValidator(
      makeRuntime(),
      caller,
      makeLoader(false),
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures.some((f) => f.error.includes('validator_unavailable'))).toBe(true);
  });

  it('records validator_unavailable on parse_failure (no parsed JSON)', async () => {
    const { caller } = makeLLMCaller(async () => emptyResult({ parsed: null }));
    const ctx = makeContext();
    const findings = await invokeGroundingValidator(
      makeRuntime(),
      caller,
      makeLoader(true),
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures.some((f) => f.error.includes('parse_failure'))).toBe(true);
  });

  it('records llm_call_failed and does not throw on rejection', async () => {
    const { caller } = makeLLMCaller(async () => {
      throw new Error('boom');
    });
    const ctx = makeContext();
    const findings = await invokeGroundingValidator(
      makeRuntime(),
      caller,
      makeLoader(true),
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures.some((f) => f.error.includes('llm_call_failed'))).toBe(true);
  });
});
