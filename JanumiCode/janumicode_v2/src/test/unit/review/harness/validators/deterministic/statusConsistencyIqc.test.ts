import { describe, it, expect } from 'vitest';
import { validateStatusConsistencyIqc } from '../../../../../../lib/review/harness/validators/deterministic/statusConsistencyIqc';
import { makeRuntime } from './_helpers';

describe('status_consistency_iqc (deterministic)', () => {
  it('returns [] for a coherent IQC pass result', () => {
    const findings = validateStatusConsistencyIqc(
      makeRuntime({
        outputContent: {
          overall_status: 'pass',
          concerns: [],
          hasConcerns: false,
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on hasConcerns/concerns mismatch (the original defect)', () => {
    const findings = validateStatusConsistencyIqc(
      makeRuntime({
        outputContent: {
          overall_status: 'requires_input',
          concerns: [],
          hasConcerns: true,
        },
      }),
    );
    const f = findings.find((x) => x.type === 'has_concerns_mismatch');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
  });

  it('flags HIGH on overall_status=blocking with no blocking concerns', () => {
    const findings = validateStatusConsistencyIqc(
      makeRuntime({
        outputContent: {
          overall_status: 'blocking',
          concerns: [{ severity: 'warning', concern: 'minor', explanation: '' }],
        },
      }),
    );
    const f = findings.find((x) => x.type === 'status_concerns_disagreement');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
  });

  it('flags HIGH on overall_status=pass with a blocking concern', () => {
    const findings = validateStatusConsistencyIqc(
      makeRuntime({
        outputContent: {
          overall_status: 'pass',
          concerns: [{ severity: 'blocking', concern: 'x', explanation: '' }],
        },
      }),
    );
    const f = findings.find((x) => x.type === 'status_concerns_disagreement');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
  });

  it('returns [] when sub_phase is not intent_quality_check', () => {
    const findings = validateStatusConsistencyIqc(
      makeRuntime({ subPhaseId: 'something_else' }),
    );
    expect(findings).toEqual([]);
  });
});
