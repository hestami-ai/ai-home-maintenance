import { describe, it, expect } from 'vitest';
import { DomainComplianceReview } from '../../../lib/review/domainComplianceReview';
import { LLMCaller } from '../../../lib/llm/llmCaller';

describe('DomainComplianceReview', () => {
  describe('shouldTrigger', () => {
    // shouldTrigger is deterministic — no LLM needed
    const review = new DomainComplianceReview(
      new LLMCaller({ maxRetries: 0 }),
      { provider: 'test', model: 'test', temperature: 0.2 },
    );

    it('returns false when no compliance regimes', () => {
      expect(review.shouldTrigger([], '2')).toBe(false);
    });

    it('returns true when regime applies to current phase', () => {
      expect(review.shouldTrigger(
        [{ name: 'GDPR', description: 'Data privacy', applicablePhases: ['2', '4'] }],
        '2',
      )).toBe(true);
    });

    it('returns false when regime does not apply to current phase', () => {
      expect(review.shouldTrigger(
        [{ name: 'GDPR', description: 'Data privacy', applicablePhases: ['4'] }],
        '2',
      )).toBe(false);
    });

    it('returns true when regime has empty applicablePhases (applies to all)', () => {
      expect(review.shouldTrigger(
        [{ name: 'SOC2', description: 'Security', applicablePhases: [] }],
        '5',
      )).toBe(true);
    });

    it('returns true if ANY regime applies', () => {
      expect(review.shouldTrigger(
        [
          { name: 'GDPR', description: 'Data privacy', applicablePhases: ['4'] },
          { name: 'HIPAA', description: 'Health data', applicablePhases: ['2'] },
        ],
        '2',
      )).toBe(true);
    });
  });
});
