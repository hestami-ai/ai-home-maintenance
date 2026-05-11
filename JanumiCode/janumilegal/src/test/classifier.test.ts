import { describe, it, expect } from 'vitest';
import { PrivilegeClassifier } from '../lib/governedStream/classifier.js';

describe('PrivilegeClassifier', () => {
  const c = new PrivilegeClassifier();

  it('uses declared classification when provided', () => {
    const r = c.classify({ eventType: 'whatever', declaredClassification: 'public_record' });
    expect(r.classification).toBe('public_record');
    expect(r.basis).toBe('declared');
  });

  it('REJECTS op_metadata as a matter-track declaration', () => {
    expect(() => c.classify({ eventType: 'x', declaredClassification: 'op_metadata' })).toThrow(/op_metadata/);
  });

  it('routes mental event types to work_product_mental', () => {
    const r = c.classify({ eventType: 'pruning_decision_recorded' });
    expect(r.classification).toBe('work_product_mental');
    expect(r.basis).toBe('rule');
  });

  it('routes factual event types to work_product_factual', () => {
    const r = c.classify({ eventType: 'fact_extracted' });
    expect(r.classification).toBe('work_product_factual');
  });

  it('routes attorney-client communication to attorney_client', () => {
    const r = c.classify({ eventType: 'client_message_received' });
    expect(r.classification).toBe('attorney_client');
  });

  it('honors caller flag for mental impressions', () => {
    const r = c.classify({ eventType: 'unknown_type', carriesMentalImpressions: true });
    expect(r.classification).toBe('work_product_mental');
  });

  it('DEFAULTS to work_product_mental for unknown event types (most restrictive)', () => {
    const r = c.classify({ eventType: 'never_seen_before' });
    expect(r.classification).toBe('work_product_mental');
    expect(r.basis).toBe('default');
  });
});
