import { describe, it, expect } from 'vitest';
import { validateHandoffFieldCompleteness } from '../../../../../../lib/review/harness/validators/deterministic/handoffFieldCompleteness';
import { makeRuntime } from './_helpers';

describe('handoff_field_completeness (deterministic)', () => {
  it('returns [] for a substantive product description', () => {
    const findings = validateHandoffFieldCompleteness(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'product_description_synthesis',
        outputContent: {
          productDescription:
            'A property management platform aligning owners, providers, and compliance.',
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on TODO placeholder', () => {
    const findings = validateHandoffFieldCompleteness(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'product_description_synthesis',
        outputContent: { productDescription: 'TODO' },
      }),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('placeholder_handoff_field');
  });

  it('flags HIGH on missing required field', () => {
    const findings = validateHandoffFieldCompleteness(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'product_description_synthesis',
        outputContent: {},
      }),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('missing_handoff_field');
  });

  it('flags MEDIUM on suspiciously short content', () => {
    const findings = validateHandoffFieldCompleteness(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'product_description_synthesis',
        outputContent: { productDescription: 'short.' },
      }),
    );
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].type).toBe('trivial_handoff_field');
  });

  it('flags HIGH on empty array for release_plan handoff', () => {
    const findings = validateHandoffFieldCompleteness(
      makeRuntime({
        agentRole: 'orchestrator',
        subPhaseId: 'release_plan',
        outputContent: { releases: [] },
      }),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('empty_handoff_array');
  });
});
