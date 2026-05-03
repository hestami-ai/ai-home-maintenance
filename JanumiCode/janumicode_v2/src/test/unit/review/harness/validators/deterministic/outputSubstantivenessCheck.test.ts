import { describe, it, expect } from 'vitest';
import { validateOutputSubstantiveness } from '../../../../../../lib/review/harness/validators/deterministic/outputSubstantivenessCheck';
import { makeRuntime } from './_helpers';

describe('output_substantiveness_check (deterministic)', () => {
  it('returns [] when output is well above the floor', () => {
    const findings = validateOutputSubstantiveness(
      makeRuntime({ outputText: 'a'.repeat(500) }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on empty output', () => {
    const findings = validateOutputSubstantiveness(
      makeRuntime({ outputText: '   ' }),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('empty_output');
  });

  it('flags HIGH below the default floor (200)', () => {
    const findings = validateOutputSubstantiveness(
      makeRuntime({ outputText: 'x'.repeat(50) }),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('below_length_floor');
  });

  it('flags MEDIUM in the suspicious-brevity band', () => {
    const findings = validateOutputSubstantiveness(
      makeRuntime({ outputText: 'x'.repeat(220) }),
    );
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].type).toBe('suspicious_brevity');
  });

  it('uses classification floor (50) for intent_lens_classification', () => {
    const findings = validateOutputSubstantiveness(
      makeRuntime({
        agentRole: 'orchestrator',
        subPhaseId: 'intent_lens_classification',
        outputText: 'x'.repeat(80),
      }),
    );
    expect(findings).toEqual([]);
  });
});
