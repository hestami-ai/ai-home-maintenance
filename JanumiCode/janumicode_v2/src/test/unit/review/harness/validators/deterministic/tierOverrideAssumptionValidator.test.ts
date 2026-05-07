import { describe, it, expect } from 'vitest';
import { validateTierOverrideAssumption } from '../../../../../../lib/review/harness/validators/deterministic/tierOverrideAssumptionValidator';
import { makeRuntime } from './_helpers';

describe('tier_override_assumption_validator (deterministic)', () => {
  it('returns [] when outputContent is null', () => {
    expect(validateTierOverrideAssumption(makeRuntime({ outputContent: null }))).toEqual([]);
  });

  it('returns [] when no children present', () => {
    expect(
      validateTierOverrideAssumption(makeRuntime({ outputContent: { children: [] } })),
    ).toEqual([]);
  });

  it('returns [] when child agrees with hint', () => {
    expect(
      validateTierOverrideAssumption(
        makeRuntime({
          outputContent: {
            children: [
              { name: 'Foo', tier: 'C', agrees_with_hint: true, surfaced_assumptions: [] },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('returns [] when override has surfaced_assumptions documenting it', () => {
    expect(
      validateTierOverrideAssumption(
        makeRuntime({
          outputContent: {
            children: [
              {
                name: 'PropertyIdentity',
                tier: 'D',
                agrees_with_hint: false,
                surfaced_assumptions: [{ text: 'Overridden because PK leaf' }],
              },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('flags LOW when override has empty surfaced_assumptions array', () => {
    const findings = validateTierOverrideAssumption(
      makeRuntime({
        outputContent: {
          children: [
            {
              name: 'PropertyIdentity',
              tier: 'D',
              agrees_with_hint: false,
              surfaced_assumptions: [],
            },
          ],
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('LOW');
    expect(findings[0].type).toBe('missing_override_rationale');
    expect(findings[0].location).toBe('$.children[0].surfaced_assumptions');
  });

  it('flags LOW when override has no surfaced_assumptions field at all', () => {
    const findings = validateTierOverrideAssumption(
      makeRuntime({
        outputContent: {
          children: [{ name: 'Foo', tier: 'D', agrees_with_hint: false }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].validatorId).toBe('tier_override_assumption_validator');
  });

  it('falls back to id then index when name is absent', () => {
    const findings = validateTierOverrideAssumption(
      makeRuntime({
        outputContent: {
          children: [{ id: 'ent-foo', tier: 'C', agrees_with_hint: false }],
        },
      }),
    );
    expect(findings[0].summary).toContain('ent-foo');
  });

  it('uses decomposed_children when children is absent', () => {
    const findings = validateTierOverrideAssumption(
      makeRuntime({
        outputContent: {
          decomposed_children: [{ name: 'Bar', tier: 'D', agrees_with_hint: false }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
  });

  it('skips non-object child entries safely', () => {
    expect(
      validateTierOverrideAssumption(
        makeRuntime({ outputContent: { children: [null, 42, 'x'] } }),
      ),
    ).toEqual([]);
  });

  it('flags every overriding child independently', () => {
    const findings = validateTierOverrideAssumption(
      makeRuntime({
        outputContent: {
          children: [
            { name: 'A', tier: 'D', agrees_with_hint: false },
            { name: 'B', tier: 'C', agrees_with_hint: true },
            { name: 'C', tier: 'D', agrees_with_hint: false },
          ],
        },
      }),
    );
    expect(findings).toHaveLength(2);
  });
});
