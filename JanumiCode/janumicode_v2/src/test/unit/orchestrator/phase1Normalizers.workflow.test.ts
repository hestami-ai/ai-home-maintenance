/**
 * Unit tests for the workflow normalizer extracted to phase1Normalizers.
 *
 * Covers the dual-shape (snake_case / camelCase) tolerance that ts-14
 * required when gpt-oss emitted `business_domain_id` per the prompt's
 * snake_case convention but the legacy normalizer read camelCase. See
 * feedback_normalizer_case_dual_keys.md.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeWorkflowV2,
  normalizeWorkflowTrigger,
} from '../../../lib/orchestrator/phases/phase1Normalizers';

describe('normalizeWorkflowV2 — dual-shape key tolerance', () => {
  it('reads snake_case keys (LLM-prompt convention)', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-FOO',
      name: 'Foo',
      description: 'd',
      business_domain_id: 'DOM-BAR',
      steps: [{ step_number: 1, actor: 'System', action: 'a', expected_outcome: 'o' }],
      triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }],
      actors: ['System'],
    });
    expect(w.businessDomainId).toBe('DOM-BAR');
    expect(w.steps).toHaveLength(1);
    expect(w.steps[0].stepNumber).toBe(1);
    expect(w.steps[0].expectedOutcome).toBe('o');
    expect(w.triggers).toHaveLength(1);
  });

  it('reads camelCase keys (legacy / internal convention)', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-FOO',
      name: 'Foo',
      description: 'd',
      businessDomainId: 'DOM-BAR',
      steps: [{ stepNumber: 2, actor: 'System', action: 'a', expectedOutcome: 'o' }],
      triggers: [],
      actors: [],
    });
    expect(w.businessDomainId).toBe('DOM-BAR');
    expect(w.steps[0].stepNumber).toBe(2);
    expect(w.steps[0].expectedOutcome).toBe('o');
  });

  it('snake_case wins when both shapes are present', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-X',
      business_domain_id: 'DOM-SNAKE',
      businessDomainId: 'DOM-CAMEL',
      steps: [],
      triggers: [],
      actors: [],
    });
    expect(w.businessDomainId).toBe('DOM-SNAKE');
  });

  it('defaults businessDomainId to empty string when neither shape is present (caller can flag)', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-X',
      name: 'X',
      description: '',
      steps: [],
      triggers: [],
      actors: [],
    });
    expect(w.businessDomainId).toBe('');
  });

  it('defaults stepNumber to 1-based index when missing on a step', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-X',
      business_domain_id: 'DOM-X',
      steps: [
        { actor: 'System', action: 'a', expected_outcome: 'o' },
        { actor: 'System', action: 'b', expected_outcome: 'o2' },
      ],
      triggers: [],
      actors: [],
    });
    expect(w.steps[0].stepNumber).toBe(1);
    expect(w.steps[1].stepNumber).toBe(2);
  });

  it('derives backs_journeys deterministically from journey_step triggers', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-X',
      business_domain_id: 'DOM-X',
      steps: [],
      triggers: [
        { kind: 'journey_step', journey_id: 'UJ-A', step_number: 1 },
        { kind: 'journey_step', journey_id: 'UJ-B', step_number: 1 },
        { kind: 'journey_step', journey_id: 'UJ-A', step_number: 2 }, // dup
        { kind: 'schedule', cadence: 'daily' },                       // non-journey
      ],
      actors: [],
    });
    expect(w.backs_journeys.sort()).toEqual(['UJ-A', 'UJ-B']);
  });

  it('ignores LLM-supplied backs_journeys (re-derives from triggers)', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-X',
      business_domain_id: 'DOM-X',
      steps: [],
      triggers: [{ kind: 'journey_step', journey_id: 'UJ-REAL', step_number: 1 }],
      actors: [],
      backs_journeys: ['UJ-LLM-CLAIMED-BUT-NOT-TRIGGERED'],
    });
    expect(w.backs_journeys).toEqual(['UJ-REAL']);
  });

  it('filters non-string actors silently', () => {
    const w = normalizeWorkflowV2({
      id: 'WF-X',
      business_domain_id: 'DOM-X',
      steps: [],
      triggers: [],
      actors: ['Persona-A', 42, null, 'Persona-B'],
    });
    expect(w.actors).toEqual(['Persona-A', 'Persona-B']);
  });

  it('coerces missing required fields to empty defaults (no throw)', () => {
    const w = normalizeWorkflowV2({});
    expect(w.id).toBe('');
    expect(w.businessDomainId).toBe('');
    expect(w.steps).toEqual([]);
    expect(w.triggers).toEqual([]);
    expect(w.actors).toEqual([]);
    expect(w.backs_journeys).toEqual([]);
  });
});

describe('normalizeWorkflowTrigger', () => {
  it('accepts journey_step with journey_id + step_number', () => {
    expect(normalizeWorkflowTrigger({ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }))
      .toEqual({ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 });
  });

  it('rejects journey_step without step_number', () => {
    expect(normalizeWorkflowTrigger({ kind: 'journey_step', journey_id: 'UJ-1' })).toBeNull();
  });

  it('accepts schedule with cadence string', () => {
    expect(normalizeWorkflowTrigger({ kind: 'schedule', cadence: 'daily at 02:00 UTC' }))
      .toEqual({ kind: 'schedule', cadence: 'daily at 02:00 UTC' });
  });

  it('accepts event with event_type', () => {
    expect(normalizeWorkflowTrigger({ kind: 'event', event_type: 'order.placed' }))
      .toEqual({ kind: 'event', event_type: 'order.placed' });
  });

  it('accepts compliance with regime_id + rule', () => {
    expect(normalizeWorkflowTrigger({ kind: 'compliance', regime_id: 'COMP-GDPR', rule: 'right-to-be-forgotten' }))
      .toEqual({ kind: 'compliance', regime_id: 'COMP-GDPR', rule: 'right-to-be-forgotten' });
  });

  it('rejects compliance without rule', () => {
    expect(normalizeWorkflowTrigger({ kind: 'compliance', regime_id: 'COMP-GDPR' })).toBeNull();
  });

  it('accepts integration with integration_id + event', () => {
    expect(normalizeWorkflowTrigger({ kind: 'integration', integration_id: 'INT-STRIPE', event: 'charge.succeeded' }))
      .toEqual({ kind: 'integration', integration_id: 'INT-STRIPE', event: 'charge.succeeded' });
  });

  it('rejects integration without event', () => {
    expect(normalizeWorkflowTrigger({ kind: 'integration', integration_id: 'INT-STRIPE' })).toBeNull();
  });

  it('rejects unknown kind (e.g. "domain" — the ts-14 failure mode)', () => {
    expect(normalizeWorkflowTrigger({ kind: 'domain', domain_id: 'DOM-FOO' })).toBeNull();
  });

  it('rejects empty / no-kind object', () => {
    expect(normalizeWorkflowTrigger({})).toBeNull();
  });
});

describe('normalizeWorkflowV2 — ts-14 regression', () => {
  it('a workflow emitted by the LLM with the exact ts-14 shape produces a non-empty businessDomainId (the cliff fix)', () => {
    // Verbatim shape from the gpt-oss output that ts-14 dropped 19/19 on.
    // Pre-fix, businessDomainId resolved to "" → all workflows dropped
    // by the Phase 1.3b self-heal with "domain-not-accepted".
    const w = normalizeWorkflowV2({
      id: 'WF-URL-CREATION',
      business_domain_id: 'DOM-URL-SHORTENING',
      name: 'URL Creation and Return',
      description: 'Handles validation, slug generation, encryption, persistence, and response',
      steps: [
        { step_number: 1, actor: 'System', action: 'Validate', expected_outcome: 'URL mapping stored' },
        { step_number: 2, actor: 'System', action: 'Return',   expected_outcome: 'Short URL returned' },
      ],
      triggers: [
        { kind: 'journey_step', journey_id: 'UJ-CREATE-SHORT-URL', step_number: 2 },
        { kind: 'journey_step', journey_id: 'UJ-API-CREATE-URL',   step_number: 2 },
      ],
      actors: ['System'],
      backs_journeys: ['UJ-CREATE-SHORT-URL', 'UJ-API-CREATE-URL'],
      umbrella: false,
      source: 'ai-proposed',
    });
    // The critical assertion — pre-fix this was "".
    expect(w.businessDomainId).toBe('DOM-URL-SHORTENING');
    expect(w.steps.map(s => s.stepNumber)).toEqual([1, 2]);
    expect(w.steps.map(s => s.expectedOutcome)).toEqual(['URL mapping stored', 'Short URL returned']);
    expect(w.triggers).toHaveLength(2);
    expect(w.backs_journeys.sort()).toEqual(['UJ-API-CREATE-URL', 'UJ-CREATE-SHORT-URL']);
  });
});
