import { describe, it, expect } from 'vitest';
import { invokeSurfacedAssumptionNovelty } from '../../../../../../lib/review/harness/validators/llm/surfacedAssumptionNovelty';
import { makeRuntime, makeLLMCaller, makeLoader, makeContext, emptyResult } from './_helpers';

describe('surfaced_assumption_novelty (hybrid deterministic+LLM)', () => {
  it('deterministic dedup: flags MEDIUM for duplicate assumption id', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { passed: true, findings: [] } }),
    );
    const findings = await invokeSurfacedAssumptionNovelty(
      makeRuntime({
        outputContent: {
          surfaced_assumptions: [
            { id: 'A-0068', text: 'Property data is immutable once submitted.' },
          ],
          existing_assumptions: [
            { id: 'A-0068', text: 'Property data is immutable once submitted.' },
          ],
        },
      }),
      caller,
      makeLoader(),
      makeContext(),
    );
    const dup = findings.find((f) => f.type === 'duplicate_assumption_id');
    expect(dup).toBeDefined();
    expect(dup?.severity).toBe('MEDIUM');
    expect(dup?.validatorId).toBe('surfaced_assumption_novelty');
  });

  it('returns [] from deterministic side when ids are unique', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { passed: true, findings: [] } }),
    );
    const findings = await invokeSurfacedAssumptionNovelty(
      makeRuntime({
        outputContent: {
          surfaced_assumptions: [{ id: 'A-0100', text: 'New assumption.' }],
          existing_assumptions: [{ id: 'A-0068', text: 'Different assumption.' }],
        },
      }),
      caller,
      makeLoader(),
      makeContext(),
    );
    // No deterministic dedup findings; LLM returns empty findings
    expect(findings.filter((f) => f.type === 'duplicate_assumption_id')).toEqual([]);
  });

  it('propagates LLM category-drift finding', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          passed: false,
          findings: [
            {
              severity: 'LOW',
              type: 'category_drift',
              summary: 'Category does not match content',
              location: '$.surfaced_assumptions[0]',
              assumptionId: 'A-0100',
              detail: 'Content is a scope decision but category is implementation_choice.',
              recommendation: 'Set category to scope.',
            },
          ],
        },
      }),
    );
    const findings = await invokeSurfacedAssumptionNovelty(
      makeRuntime({
        outputContent: {
          surfaced_assumptions: [{ id: 'A-0100', text: 'Different assumption.' }],
          existing_assumptions: [],
        },
      }),
      caller,
      makeLoader(),
      makeContext(),
    );
    const drift = findings.find((f) => f.type === 'category_drift');
    expect(drift).toBeDefined();
    expect(drift?.severity).toBe('LOW');
  });
});
