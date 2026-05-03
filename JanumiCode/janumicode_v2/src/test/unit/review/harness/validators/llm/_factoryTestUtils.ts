/**
 * Shared test driver for factory-pattern LLM validators.
 *
 * Each new factory validator gets a ~10-line test file that calls
 * `runFactoryContractSuite(...)` with its `invoke` function and the
 * expected validator id. The suite asserts the three standard
 * lifecycle contracts:
 *   1. clean: parsed JSON with empty findings → returns [] and stamps
 *      traceContext as `harness:<validator_id>`.
 *   2. HIGH defect: a single finding round-trips with severity preserved.
 *   3. validator_unavailable on parse failure (parsed: null).
 */

import { describe, it, expect } from 'vitest';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';
import type { LLMValidatorInvoke } from '../../../../../../lib/review/harness/validators/llm/llmValidatorRunner';
import type { ValidatorRuntimeParams } from '../../../../../../lib/review/harness/validatorRegistry';

export interface FactoryContractOptions {
  /** Optional per-test runtime overrides (e.g., agentRole / subPhaseId). */
  runtime?: Partial<ValidatorRuntimeParams>;
}

export function runFactoryContractSuite(
  validatorId: string,
  invoke: LLMValidatorInvoke,
  options: FactoryContractOptions = {},
): void {
  describe(`${validatorId} (LLM, factory)`, () => {
    it('runs clean and stamps the harness traceContext', async () => {
      const { caller, callMock } = makeLLMCaller(async () =>
        emptyResult({ parsed: { findings: [] } }),
      );
      const loader = makeLoader(true);
      const ctx = makeContext();
      const findings = await invoke(makeRuntime(options.runtime), caller, loader, ctx);
      expect(findings).toEqual([]);
      expect(loader.findTemplate).toHaveBeenCalledWith('harness', validatorId);
      const call = callMock.mock.calls[0][0];
      expect(call.responseFormat).toBe('json');
      expect(call.traceContext.agentRole).toBe('harness');
      expect(call.traceContext.label).toBe(`harness:${validatorId}`);
    });

    it('maps a HIGH finding to ValidatorFinding with severity preserved', async () => {
      const { caller } = makeLLMCaller(async () =>
        emptyResult({
          parsed: {
            findings: [
              {
                severity: 'HIGH',
                type: 'sample_defect',
                summary: 's',
                location: 'l',
                detail: 'd',
                recommendation: 'r',
              },
            ],
          },
        }),
      );
      const findings = await invoke(
        makeRuntime(options.runtime),
        caller,
        makeLoader(true),
        makeContext(),
      );
      expect(findings.length).toBe(1);
      expect(findings[0].validatorId).toBe(validatorId);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].type).toBe('sample_defect');
    });

    it('records validator_unavailable on parse_failure', async () => {
      const { caller } = makeLLMCaller(async () => emptyResult({ parsed: null }));
      const ctx = makeContext();
      const findings = await invoke(
        makeRuntime(options.runtime),
        caller,
        makeLoader(true),
        ctx,
      );
      expect(findings).toEqual([]);
      expect(
        ctx.failures.some(
          (f) => f.validatorId === validatorId && f.error.includes('parse_failure'),
        ),
      ).toBe(true);
    });
  });
}
