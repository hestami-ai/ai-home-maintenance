import { describe, it, expect } from 'vitest';
import { validateSrAllocationCompleteness } from '../../../../../../lib/review/harness/validators/deterministic/srAllocationCompletenessValidator';
import { makeRuntime } from './_helpers';

describe('sr_allocation_completeness_validator (deterministic)', () => {
  it('returns [] when no SR ids in prompt', () => {
    expect(
      validateSrAllocationCompleteness(
        makeRuntime({
          originalPrompt: 'No SR ids here.',
          outputContent: { components: [] },
        }),
      ),
    ).toEqual([]);
  });

  it('returns [] when all SRs are covered by components', () => {
    const findings = validateSrAllocationCompleteness(
      makeRuntime({
        originalPrompt: 'System requirement SR-001 and SR-002.',
        outputContent: {
          components: [
            { id: 'comp-1', allocated_srs: ['SR-001', 'SR-002'] },
          ],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on uncovered SR', () => {
    const findings = validateSrAllocationCompleteness(
      makeRuntime({
        originalPrompt: 'SR-001 is the key requirement.',
        outputContent: {
          components: [
            { id: 'comp-1', allocated_srs: [] },
          ],
        },
      }),
    );
    expect(findings.some((f) => f.severity === 'HIGH' && f.type === 'uncovered_sr')).toBe(true);
  });

  it('flags MEDIUM on cross-allocation without cross_cuts declaration', () => {
    const findings = validateSrAllocationCompleteness(
      makeRuntime({
        originalPrompt: 'SR-001 spans two components.',
        outputContent: {
          components: [
            { id: 'comp-1', allocated_srs: ['SR-001'], cross_cuts: [] },
            { id: 'comp-2', allocated_srs: ['SR-001'], cross_cuts: [] },
          ],
        },
      }),
    );
    expect(findings.some((f) => f.severity === 'MEDIUM' && f.type === 'undeclared_cross_allocation')).toBe(true);
  });

  it('returns [] when cross-allocation is declared in cross_cuts', () => {
    const findings = validateSrAllocationCompleteness(
      makeRuntime({
        originalPrompt: 'SR-001 spans two components.',
        outputContent: {
          components: [
            { id: 'comp-1', allocated_srs: ['SR-001'], cross_cuts: ['SR-001'] },
            { id: 'comp-2', allocated_srs: ['SR-001'], cross_cuts: ['SR-001'] },
          ],
        },
      }),
    );
    expect(findings).toEqual([]);
  });
});
