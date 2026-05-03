import { describe, it, expect } from 'vitest';
import { validateEnrichmentEchoInvariance } from '../../../../../../lib/review/harness/validators/deterministic/enrichmentEchoInvariance';
import { makeRuntime } from './_helpers';

interface SubstrateInjected {
  substrate?: {
    skeletonStories?: Array<{ id: string; role?: string; action?: string; outcome?: string }>;
    skeletonNfrs?: Array<{ id: string; category?: string; description?: string }>;
  };
}

function withSubstrate(extra: SubstrateInjected['substrate'], rest: Parameters<typeof makeRuntime>[0] = {}): ReturnType<typeof makeRuntime> {
  const r = makeRuntime(rest) as ReturnType<typeof makeRuntime> & SubstrateInjected;
  r.substrate = extra;
  return r;
}

describe('enrichment_echo_invariance (deterministic)', () => {
  it('returns [] when every skeleton story echoes verbatim', () => {
    const findings = validateEnrichmentEchoInvariance(
      withSubstrate(
        {
          skeletonStories: [
            { id: 'US-001', role: 'owner', action: 'create', outcome: 'listed' },
          ],
        },
        {
          outputContent: {
            user_stories: [
              {
                id: 'US-001',
                role: 'owner',
                action: 'create',
                outcome: 'listed',
                acceptance_criteria: ['AC-1'],
              },
            ],
          },
        },
      ),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on dropped story', () => {
    const findings = validateEnrichmentEchoInvariance(
      withSubstrate(
        { skeletonStories: [{ id: 'US-001' }] },
        { outputContent: { user_stories: [] } },
      ),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('dropped_story');
  });

  it('flags HIGH on mutated field', () => {
    const findings = validateEnrichmentEchoInvariance(
      withSubstrate(
        {
          skeletonStories: [
            { id: 'US-001', role: 'owner', action: 'a', outcome: 'b' },
          ],
        },
        {
          outputContent: {
            user_stories: [
              { id: 'US-001', role: 'admin', action: 'a', outcome: 'b' },
            ],
          },
        },
      ),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('mutated_field');
  });

  it('returns [] when no substrate is provided (degraded mode)', () => {
    const findings = validateEnrichmentEchoInvariance(
      makeRuntime({ outputContent: { user_stories: [] } }),
    );
    expect(findings).toEqual([]);
  });
});
