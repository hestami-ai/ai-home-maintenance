import { describe, it, expect } from 'vitest';
import { invokeFinalSynthesis } from '../../../../../../lib/review/harness/validators/llm/finalSynthesis';
import type { ValidatorFinding } from '../../../../../../lib/review/harness/validatorRegistry';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

const HIGH_FINDING: ValidatorFinding = {
  validatorId: 'grounding_validator',
  severity: 'HIGH',
  type: 'unsupported_claim',
  summary: 's',
  location: '$.x',
  detail: 'd',
  recommendation: 'r',
};

describe('final_synthesis (deterministic decision + LLM narrative — Commit 8)', () => {
  it('with no upstream findings -> ACCEPT (LOW severity finding emitted)', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { decision_rationale: 'all clean' } }),
    );
    const findings = await invokeFinalSynthesis(
      makeRuntime({ upstreamFindings: [] }),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].validatorId).toBe('final_synthesis');
    expect(findings[0].type).toBe('final_synthesis_decision');
    expect(findings[0].summary).toBe('decision=ACCEPT');
    expect(findings[0].severity).toBe('LOW');
  });

  it('with one HIGH upstream finding -> REVISE (MEDIUM severity)', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { decision_rationale: 'one high' } }),
    );
    const findings = await invokeFinalSynthesis(
      makeRuntime({ upstreamFindings: [HIGH_FINDING] }),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings[0].summary).toBe('decision=REVISE');
    expect(findings[0].severity).toBe('MEDIUM');
  });

  it('with two HIGH upstream findings -> QUARANTINE (HIGH severity)', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { decision_rationale: 'two high' } }),
    );
    const findings = await invokeFinalSynthesis(
      makeRuntime({ upstreamFindings: [HIGH_FINDING, HIGH_FINDING] }),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings[0].summary).toBe('decision=QUARANTINE');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('emits decision finding even when template is missing (LLM narrative skipped)', async () => {
    const { caller, callMock } = makeLLMCaller();
    const findings = await invokeFinalSynthesis(
      makeRuntime({ upstreamFindings: [] }),
      caller,
      makeLoader(false),
      makeContext(),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].summary).toBe('decision=ACCEPT');
    expect(callMock).not.toHaveBeenCalled();
  });

  it('LLM call failure does NOT change the deterministic decision', async () => {
    const { caller } = makeLLMCaller(async () => {
      throw new Error('boom');
    });
    const findings = await invokeFinalSynthesis(
      makeRuntime({ upstreamFindings: [HIGH_FINDING, HIGH_FINDING] }),
      caller,
      makeLoader(true),
      makeContext(),
    );
    expect(findings[0].summary).toBe('decision=QUARANTINE');
    expect(findings[0].severity).toBe('HIGH');
    // Narrative shows the failure note
    expect(findings[0].detail).toContain('narrative LLM call failed');
  });
});
