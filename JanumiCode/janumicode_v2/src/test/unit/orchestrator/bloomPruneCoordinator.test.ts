import { describe, it, expect } from 'vitest';
import { BloomPruneCoordinator, type PendingDecision } from '../../../lib/orchestrator/bloomPruneCoordinator';

function decision(overrides: Partial<PendingDecision> & { id: string; priority: 1 | 2 | 3 | 4 }): PendingDecision {
  return {
    category: 'test',
    question: 'Test question?',
    options: [{ id: 'a', label: 'A', description: 'Option A', isRecommended: false }],
    estimatedComplexity: 'low',
    isPriorDecisionOverride: false,
    isComplianceSelection: false,
    isSystemProposalApproval: false,
    ...overrides,
  };
}

describe('BloomPruneCoordinator', () => {
  const coordinator = new BloomPruneCoordinator();

  describe('sequencing priority', () => {
    it('orders decisions by priority (1 before 2 before 3 before 4)', () => {
      const result = coordinator.sequence([
        decision({ id: 'd4', priority: 4 }),
        decision({ id: 'd1', priority: 1 }),
        decision({ id: 'd3', priority: 3 }),
        decision({ id: 'd2', priority: 2 }),
      ]);

      // Priority 1 and 2 are always individual
      const individualIds = result.individualDecisions.map(d => d.id);
      expect(individualIds[0]).toBe('d1');
      expect(individualIds[1]).toBe('d2');
    });

    it('keeps priority 1 (scope/boundary) as individual', () => {
      const result = coordinator.sequence([
        decision({ id: 'd1', priority: 1, question: 'Scope decision' }),
      ]);

      expect(result.individualDecisions).toHaveLength(1);
      expect(result.bundles).toHaveLength(0);
    });

    it('keeps priority 2 (compliance) as individual', () => {
      const result = coordinator.sequence([
        decision({ id: 'd2', priority: 2, isComplianceSelection: true }),
      ]);

      expect(result.individualDecisions).toHaveLength(1);
    });
  });

  describe('bundling', () => {
    it('bundles multiple priority 4 low-complexity decisions', () => {
      const result = coordinator.sequence([
        decision({ id: 'd4a', priority: 4, estimatedComplexity: 'low' }),
        decision({ id: 'd4b', priority: 4, estimatedComplexity: 'low' }),
        decision({ id: 'd4c', priority: 4, estimatedComplexity: 'low' }),
      ]);

      expect(result.individualDecisions).toHaveLength(0);
      expect(result.bundles).toHaveLength(1);
      expect(result.bundles[0].decisions).toHaveLength(3);
    });

    it('does not bundle a single remaining decision', () => {
      const result = coordinator.sequence([
        decision({ id: 'd4a', priority: 4, estimatedComplexity: 'low' }),
      ]);

      // Single item — no bundle created, goes to individual
      expect(result.bundles).toHaveLength(0);
    });
  });

  describe('bundle exclusions (§7.5)', () => {
    it('never bundles prior decision overrides', () => {
      expect(coordinator.canBundle(
        decision({ id: 'd', priority: 4, isPriorDecisionOverride: true })
      )).toBe(false);
    });

    it('never bundles compliance selections', () => {
      expect(coordinator.canBundle(
        decision({ id: 'd', priority: 4, isComplianceSelection: true })
      )).toBe(false);
    });

    it('never bundles System-Proposed Content approvals', () => {
      expect(coordinator.canBundle(
        decision({ id: 'd', priority: 4, isSystemProposalApproval: true })
      )).toBe(false);
    });

    it('never bundles high-complexity decisions', () => {
      expect(coordinator.canBundle(
        decision({ id: 'd', priority: 3, estimatedComplexity: 'high' })
      )).toBe(false);
    });

    it('allows bundling for low-complexity priority 3', () => {
      expect(coordinator.canBundle(
        decision({ id: 'd', priority: 3, estimatedComplexity: 'low' })
      )).toBe(true);
    });

    it('allows bundling for priority 4', () => {
      expect(coordinator.canBundle(
        decision({ id: 'd', priority: 4 })
      )).toBe(true);
    });
  });
});
