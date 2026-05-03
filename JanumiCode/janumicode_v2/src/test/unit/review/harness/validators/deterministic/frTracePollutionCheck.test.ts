import { describe, it, expect } from 'vitest';
import { validateFrTracePollutionCheck } from '../../../../../../lib/review/harness/validators/deterministic/frTracePollutionCheck';
import { makeRuntime } from './_helpers';

describe('fr_trace_pollution_check (deterministic)', () => {
  it('returns [] when traces only reference V&V / COMP ids', () => {
    const findings = validateFrTracePollutionCheck(
      makeRuntime({
        outputContent: {
          requirements: [{ id: 'NFR-001', traces_to: ['VV-LATENCY', 'COMP-PCI'] }],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on US-* in traces_to', () => {
    const findings = validateFrTracePollutionCheck(
      makeRuntime({
        outputContent: {
          requirements: [{ id: 'NFR-002', traces_to: ['US-001'] }],
        },
      }),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('fr_id_in_nfr_traces');
  });

  it('flags HIGH on AC-* in traces_to', () => {
    const findings = validateFrTracePollutionCheck(
      makeRuntime({
        outputContent: {
          requirements: [{ id: 'NFR-003', traces_to: ['AC-007'] }],
        },
      }),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('HIGH');
  });
});
