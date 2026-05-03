import { describe, it, expect } from 'vitest';
import { validateStoryStructuralCompleteness } from '../../../../../../lib/review/harness/validators/deterministic/storyStructuralCompleteness';
import { makeRuntime } from './_helpers';

describe('story_structural_completeness (deterministic)', () => {
  it('returns [] when every story is complete', () => {
    const findings = validateStoryStructuralCompleteness(
      makeRuntime({
        outputContent: {
          user_stories: [
            {
              id: 'US-001',
              role: 'owner',
              action: 'create a property',
              outcome: 'property is listed',
              priority: 'must',
            },
          ],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on missing required field', () => {
    const findings = validateStoryStructuralCompleteness(
      makeRuntime({
        outputContent: {
          user_stories: [
            {
              id: 'US-001',
              role: 'owner',
              action: 'create',
              priority: 'must',
              // outcome missing
            },
          ],
        },
      }),
    );
    const high = findings.find((f) => f.severity === 'HIGH');
    expect(high).toBeDefined();
    expect(high?.location).toContain('outcome');
  });

  it('flags MEDIUM on unrecognised priority', () => {
    const findings = validateStoryStructuralCompleteness(
      makeRuntime({
        outputContent: {
          user_stories: [
            {
              id: 'US-002',
              role: 'admin',
              action: 'audit',
              outcome: 'logged',
              priority: 'whenever',
            },
          ],
        },
      }),
    );
    const med = findings.find((f) => f.severity === 'MEDIUM');
    expect(med).toBeDefined();
    expect(med?.type).toBe('unknown_priority');
  });
});
