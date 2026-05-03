import { describe, it, expect } from 'vitest';
import { validatePersonaIdContinuity } from '../../../../../../lib/review/harness/validators/deterministic/personaIdContinuity';
import { makeRuntime } from './_helpers';

describe('persona_id_continuity (deterministic)', () => {
  it('returns [] when every reference resolves', () => {
    const findings = validatePersonaIdContinuity(
      makeRuntime({
        outputContent: {
          personas: [{ id: 'P-OWNER' }, { id: 'P-PROVIDER' }],
          userJourneys: [{ id: 'UJ-1', actor: 'P-OWNER' }],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on undefined persona reference', () => {
    const findings = validatePersonaIdContinuity(
      makeRuntime({
        outputContent: {
          personas: [{ id: 'P-OWNER' }],
          userJourneys: [{ id: 'UJ-1', actor: 'P-MISSING' }],
        },
      }),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('undefined_persona_reference');
  });

  it('returns [] when output is empty', () => {
    const findings = validatePersonaIdContinuity(makeRuntime({ outputContent: {} }));
    expect(findings).toEqual([]);
  });
});
