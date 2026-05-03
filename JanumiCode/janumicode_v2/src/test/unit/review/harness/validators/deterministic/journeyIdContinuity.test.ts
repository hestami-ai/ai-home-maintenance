import { describe, it, expect } from 'vitest';
import { validateJourneyIdContinuity } from '../../../../../../lib/review/harness/validators/deterministic/journeyIdContinuity';
import { makeRuntime } from './_helpers';

describe('journey_id_continuity (deterministic)', () => {
  it('returns [] when every UJ-* reference resolves', () => {
    const findings = validateJourneyIdContinuity(
      makeRuntime({
        outputContent: {
          userJourneys: [{ id: 'UJ-OWNER_ONBOARD' }, { id: 'UJ-PROVIDER_BID' }],
          surfaces: ['related to UJ-OWNER_ONBOARD'],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on undefined journey reference', () => {
    const findings = validateJourneyIdContinuity(
      makeRuntime({
        outputContent: {
          userJourneys: [{ id: 'UJ-A' }],
          phasing: { phase1: ['UJ-A', 'UJ-B'] },
        },
      }),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('undefined_journey_reference');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('returns [] when output is empty', () => {
    const findings = validateJourneyIdContinuity(makeRuntime({ outputContent: {} }));
    expect(findings).toEqual([]);
  });
});
