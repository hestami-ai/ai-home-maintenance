/**
 * Unit tests for T4 SRP-at-Tier-A deterministic assertion.
 */
import { describe, it, expect } from 'vitest';
import { checkT4Principle } from '../../regression/assertions/t4PrincipleInvariants';
import type { T4PrincipleAssertion } from '../../regression/fixtureSchema';

function baseAssertion(overrides: Partial<T4PrincipleAssertion> = {}): T4PrincipleAssertion {
  return {
    name: 'tier_a_srp',
    kind: 'tier_a_srp_violation',
    path: 'components[]',
    ...overrides,
  };
}

describe('T4 — tier_a_srp_violation', () => {
  it('passes on a healthy capability-shaped top-tier decomposition', () => {
    const parsed = {
      components: [
        {
          id: 'comp-order-lifecycle',
          name: 'Order Lifecycle',
          responsibilities: [
            { id: 'r1', description: 'Manage order state transitions' },
            { id: 'r2', description: 'Coordinate assignment to fulfillment' },
            { id: 'r3', description: 'Emit completion audit events' },
          ],
          dependencies: [],
        },
        {
          id: 'comp-payment-processing',
          name: 'Payment Processing',
          responsibilities: [
            { id: 'r4', description: 'Authorize payment via gateway' },
            { id: 'r5', description: 'Settle and reconcile transactions' },
          ],
          dependencies: [],
        },
      ],
    };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.passed).toBe(true);
  });

  it('flags Smell A (noun collision with single-responsibility siblings)', () => {
    const parsed = {
      components: [
        { id: 'comp-order-validation', name: 'Order Validation',
          responsibilities: [{ id: 'r1', description: 'Validate order data' }], dependencies: [] },
        { id: 'comp-order-persistence', name: 'Order Persistence',
          responsibilities: [{ id: 'r2', description: 'Persist order' }], dependencies: [] },
        { id: 'comp-order-emission', name: 'Order Emission',
          responsibilities: [{ id: 'r3', description: 'Emit order events' }], dependencies: [] },
      ],
    };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.passed).toBe(false);
    expect(c.detail).toMatch(/noun_collision/);
    expect(c.detail).toMatch(/order/i);
  });

  it('flags Smell B (id suffix drift -A/-B/-C)', () => {
    const parsed = {
      components: [
        { id: 'comp-payment-A', name: 'PaymentA',
          responsibilities: [{ id: 'r1', description: 'Foo' }, { id: 'r2', description: 'Bar' }] },
        { id: 'comp-payment-B', name: 'PaymentB',
          responsibilities: [{ id: 'r3', description: 'Baz' }, { id: 'r4', description: 'Quux' }] },
        { id: 'comp-payment-C', name: 'PaymentC',
          responsibilities: [{ id: 'r5', description: 'Zap' }, { id: 'r6', description: 'Pow' }] },
      ],
    };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.passed).toBe(false);
    expect(c.detail).toMatch(/id_suffix_drift/);
  });

  it('flags Smell C (≥2 top-tier nodes with single verb-led responsibility)', () => {
    const parsed = {
      components: [
        { id: 'comp-foo', name: 'Foo',
          responsibilities: [{ id: 'r1', description: 'Validate the input payload' }], dependencies: [] },
        { id: 'comp-bar', name: 'Bar',
          responsibilities: [{ id: 'r2', description: 'Persist the record to storage' }], dependencies: [] },
        { id: 'comp-baz', name: 'Baz',
          responsibilities: [{ id: 'r3', description: 'Emit the event to the bus' }], dependencies: [] },
      ],
    };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.passed).toBe(false);
    expect(c.detail).toMatch(/single_verb_responsibility/);
  });

  it('tolerates ONE Tier-A node with a single verb-led responsibility (atomic service is legit)', () => {
    const parsed = {
      components: [
        { id: 'comp-audit-log', name: 'Audit Log',
          responsibilities: [{ id: 'r1', description: 'Persist audit entries' }], dependencies: [] },
        { id: 'comp-order-lifecycle', name: 'Order Lifecycle',
          responsibilities: [
            { id: 'r2', description: 'Manage state' },
            { id: 'r3', description: 'Coordinate assignment' },
          ], dependencies: [] },
      ],
    };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.passed).toBe(true);
  });

  it('flags Smell D (high cross-sibling dependency density)', () => {
    const parsed = {
      components: [
        { id: 'comp-a', name: 'A',
          responsibilities: [{ id: 'r1', description: 'foo' }, { id: 'r2', description: 'bar' }],
          dependencies: [{ component_id: 'comp-b' }, { component_id: 'comp-c' }, { component_id: 'comp-d' }] },
        { id: 'comp-b', name: 'B',
          responsibilities: [{ id: 'r3', description: 'baz' }, { id: 'r4', description: 'quux' }],
          dependencies: [{ component_id: 'comp-a' }, { component_id: 'comp-c' }, { component_id: 'comp-d' }] },
        { id: 'comp-c', name: 'C',
          responsibilities: [{ id: 'r5', description: 'zap' }, { id: 'r6', description: 'pow' }],
          dependencies: [{ component_id: 'comp-a' }, { component_id: 'comp-b' }, { component_id: 'comp-d' }] },
        { id: 'comp-d', name: 'D',
          responsibilities: [{ id: 'r7', description: 'mash' }, { id: 'r8', description: 'splat' }],
          dependencies: [{ component_id: 'comp-a' }, { component_id: 'comp-b' }, { component_id: 'comp-c' }] },
      ],
    };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.passed).toBe(false);
    expect(c.detail).toMatch(/cross_sibling_dependency_density/);
  });

  it('respects tier_filter (only checks tier=A children in saturation output)', () => {
    const parsed = {
      children: [
        { id: 'comp-foo-A', tier: 'A',
          responsibilities: [{ id: 'r1', description: 'Validate foo' }] },
        { id: 'comp-foo-B', tier: 'A',
          responsibilities: [{ id: 'r2', description: 'Persist foo' }] },
        // Tier C children with the same noun stem — should NOT be flagged
        // because the assertion is filtered to Tier A.
        { id: 'comp-bar-C', tier: 'C',
          responsibilities: [{ id: 'r3', description: 'Validate bar' }] },
        { id: 'comp-bar-D', tier: 'C',
          responsibilities: [{ id: 'r4', description: 'Persist bar' }] },
      ],
    };
    const c = checkT4Principle(
      baseAssertion({ path: 'children[]', tier_filter: 'A' }),
      parsed,
    );
    expect(c.passed).toBe(false);
    expect(c.detail).toMatch(/foo/i);
    expect(c.detail).not.toMatch(/bar/i);
  });

  it('reports advisory severity by default', () => {
    const parsed = { components: [{ id: 'comp-foo-A', responsibilities: [{ id: 'r1', description: 'V' }] }, { id: 'comp-foo-B', responsibilities: [{ id: 'r2', description: 'P' }] }] };
    const c = checkT4Principle(baseAssertion(), parsed);
    expect(c.severity).toBe('advisory');
  });

  it('respects severity override to blocking', () => {
    const parsed = { components: [{ id: 'comp-foo-A', responsibilities: [{ id: 'r1', description: 'V' }] }, { id: 'comp-foo-B', responsibilities: [{ id: 'r2', description: 'P' }] }] };
    const c = checkT4Principle(baseAssertion({ severity: 'blocking' }), parsed);
    expect(c.severity).toBe('blocking');
  });

  it('returns pass with skip-detail when path matches no items', () => {
    const c = checkT4Principle(baseAssertion(), { components: [] });
    expect(c.passed).toBe(true);
    expect(c.detail).toMatch(/no components matched/);
  });

  it('returns fail when parsed is null', () => {
    const c = checkT4Principle(baseAssertion(), null);
    expect(c.passed).toBe(false);
  });

  it('individual smell toggles can disable a check', () => {
    const parsed = {
      components: [
        { id: 'comp-foo-A', responsibilities: [{ id: 'r1', description: 'Validate foo' }] },
        { id: 'comp-foo-B', responsibilities: [{ id: 'r2', description: 'Persist foo' }] },
      ],
    };
    const c = checkT4Principle(
      baseAssertion({
        noun_collision_check: false,
        id_suffix_check: false,
        single_verb_responsibility_check: false,
        cross_sibling_dependency_check: false,
      }),
      parsed,
    );
    expect(c.passed).toBe(true);
  });
});
