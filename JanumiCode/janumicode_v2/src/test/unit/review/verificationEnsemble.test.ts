import { describe, it, expect } from 'vitest';

/**
 * Tests for VerificationEnsemble agreement logic.
 * Tests the comparison logic in isolation using the types directly,
 * without making actual LLM calls.
 */

// Import types for test data construction
import type { ReasoningReviewResult, ReasoningFlaw } from '../../../lib/review/reasoningReview';

// Helper to build a mock review result
function mockResult(overrides: Partial<ReasoningReviewResult> = {}): ReasoningReviewResult {
  return {
    overallPass: true,
    flaws: [],
    traceSelectionRecordIds: ['r1'],
    traceSamplingApplied: false,
    traceStrideN: null,
    subPhaseId: '1.2',
    ...overrides,
  };
}

function flaw(type: string, severity: 'high' | 'low'): ReasoningFlaw {
  return {
    flawType: type as ReasoningFlaw['flawType'],
    severity,
    description: `Test flaw: ${type}`,
    evidence: 'Test evidence',
    recommendedAction: 'retry',
  };
}

// Inline the comparison logic for unit testing
// (The actual VerificationEnsemble.compareResults is private, so we replicate it here)
function compareResults(
  primary: ReasoningReviewResult,
  secondary: ReasoningReviewResult,
): { agreement: boolean; agreementType: string; severityDisagreements: unknown[] } {
  if (primary.overallPass !== secondary.overallPass) {
    return { agreement: false, agreementType: 'overall_disagreement', severityDisagreements: [] };
  }

  const primaryFlawMap = new Map<string, 'high' | 'low'>();
  for (const f of primary.flaws) {
    const existing = primaryFlawMap.get(f.flawType);
    if (!existing || f.severity === 'high') primaryFlawMap.set(f.flawType, f.severity);
  }

  const secondaryFlawMap = new Map<string, 'high' | 'low'>();
  for (const f of secondary.flaws) {
    const existing = secondaryFlawMap.get(f.flawType);
    if (!existing || f.severity === 'high') secondaryFlawMap.set(f.flawType, f.severity);
  }

  const allFlawTypes = new Set([...primaryFlawMap.keys(), ...secondaryFlawMap.keys()]);
  const disagreements: { flawType: string; primary: string; secondary: string }[] = [];

  for (const ft of allFlawTypes) {
    const p = primaryFlawMap.get(ft) ?? 'absent';
    const s = secondaryFlawMap.get(ft) ?? 'absent';
    if ((p === 'high' && s !== 'high') || (s === 'high' && p !== 'high')) {
      disagreements.push({ flawType: ft, primary: p, secondary: s });
    }
  }

  if (disagreements.length > 0) {
    return { agreement: false, agreementType: 'severity_disagreement', severityDisagreements: disagreements };
  }

  return { agreement: true, agreementType: 'full', severityDisagreements: [] };
}

describe('VerificationEnsemble — agreement logic', () => {
  it('full agreement when both pass with no flaws', () => {
    const primary = mockResult({ overallPass: true, flaws: [] });
    const secondary = mockResult({ overallPass: true, flaws: [] });

    const result = compareResults(primary, secondary);
    expect(result.agreement).toBe(true);
    expect(result.agreementType).toBe('full');
  });

  it('full agreement when both fail with same flaw types and severities', () => {
    const primary = mockResult({
      overallPass: false,
      flaws: [flaw('unsupported_assumption', 'high')],
    });
    const secondary = mockResult({
      overallPass: false,
      flaws: [flaw('unsupported_assumption', 'high')],
    });

    const result = compareResults(primary, secondary);
    expect(result.agreement).toBe(true);
    expect(result.agreementType).toBe('full');
  });

  it('overall_disagreement when pass differs', () => {
    const primary = mockResult({ overallPass: true, flaws: [] });
    const secondary = mockResult({
      overallPass: false,
      flaws: [flaw('scope_violation', 'high')],
    });

    const result = compareResults(primary, secondary);
    expect(result.agreement).toBe(false);
    expect(result.agreementType).toBe('overall_disagreement');
  });

  it('severity_disagreement when same flaw type has different severities', () => {
    const primary = mockResult({
      overallPass: false,
      flaws: [flaw('implementation_divergence', 'high')],
    });
    const secondary = mockResult({
      overallPass: false,
      flaws: [flaw('implementation_divergence', 'low')],
    });

    const result = compareResults(primary, secondary);
    expect(result.agreement).toBe(false);
    expect(result.agreementType).toBe('severity_disagreement');
    expect(result.severityDisagreements).toHaveLength(1);
  });

  it('severity_disagreement when one finds high-severity flaw the other misses', () => {
    const primary = mockResult({
      overallPass: false,
      flaws: [flaw('premature_convergence', 'high')],
    });
    const secondary = mockResult({
      overallPass: false,
      flaws: [], // Misses the flaw entirely
    });

    const result = compareResults(primary, secondary);
    expect(result.agreement).toBe(false);
    expect(result.agreementType).toBe('severity_disagreement');
  });

  it('full agreement when both have low-severity flaws only', () => {
    const primary = mockResult({
      overallPass: true,
      flaws: [flaw('unacknowledged_uncertainty', 'low')],
    });
    const secondary = mockResult({
      overallPass: true,
      flaws: [flaw('unacknowledged_uncertainty', 'low')],
    });

    const result = compareResults(primary, secondary);
    expect(result.agreement).toBe(true);
    expect(result.agreementType).toBe('full');
  });

  it('full agreement when low-severity flaws differ between providers', () => {
    const primary = mockResult({
      overallPass: true,
      flaws: [flaw('unacknowledged_uncertainty', 'low')],
    });
    const secondary = mockResult({
      overallPass: true,
      flaws: [], // Secondary finds no flaws
    });

    const result = compareResults(primary, secondary);
    // Both low-severity or absent — no disagreement
    expect(result.agreement).toBe(true);
    expect(result.agreementType).toBe('full');
  });
});
