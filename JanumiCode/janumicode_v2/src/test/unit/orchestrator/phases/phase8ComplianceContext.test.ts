/**
 * PA-14 — the Phase-8 `compliance_context_summary` deterministic bridge.
 * The eval prompt previously hardcoded the literal 'No compliance regimes'
 * regardless of the Phase-1.0d compliance artifact, so the model could never
 * mint compliance evaluation criteria even when regimes existed.
 * formatComplianceContextSummary turns the real complianceExtractedItems into an
 * id-preserving block, or a self-neutralizing sentinel when there are none.
 */
import { describe, it, expect } from 'vitest';
import { formatComplianceContextSummary } from '../../../../lib/orchestrator/phases/phase8';

describe('formatComplianceContextSummary (PA-14)', () => {
  it('renders present items as an id-preserving block (not the old literal)', () => {
    const out = formatComplianceContextSummary([
      { id: 'COMP-1', type: 'CONSTRAINT', text: 'GDPR right-to-erasure within 30d' },
      { id: 'COMP-2', type: 'REQUIREMENT', text: 'PCI-DSS cardholder data isolation' },
    ]);
    expect(out).toContain('COMP-1');
    expect(out).toContain('COMP-2');
    expect(out).toContain('GDPR right-to-erasure within 30d');
    expect(out).toContain('PCI-DSS cardholder data isolation');
    expect(out).toContain('[CONSTRAINT]');
    expect(out).not.toContain('No compliance regimes');
  });

  it('returns the neutral self-describing sentinel for an empty array (neutralizes the dangling rule)', () => {
    const out = formatComplianceContextSummary([]);
    expect(out).toContain('expected');
    expect(out).toContain('not a coverage gap');
    expect(out).not.toBe('No compliance regimes');
    expect(out).not.toContain('No compliance regimes');
  });

  it('returns the neutral sentinel for undefined / non-array input', () => {
    for (const bad of [undefined, null, 'nope', 42, {}]) {
      const out = formatComplianceContextSummary(bad);
      expect(out).toContain('not a coverage gap');
    }
  });

  it('tolerates malformed items: skips those without a string text, no [object Object]/undefined leakage', () => {
    const out = formatComplianceContextSummary([
      { id: 'COMP-3', type: 'DECISION', text: 'retain audit ledger 7y' }, // kept
      { id: 'COMP-4', type: 'CONSTRAINT' },                               // no text → skipped
      { id: 'COMP-5', text: 42 },                                         // non-string text → skipped
      'garbage',                                                          // non-object → skipped
      null,                                                              // null → skipped
    ]);
    expect(out).toContain('COMP-3');
    expect(out).toContain('retain audit ledger 7y');
    expect(out).not.toContain('COMP-4');
    expect(out).not.toContain('COMP-5');
    expect(out).not.toContain('[object Object]');
    expect(out).not.toContain('undefined');
  });

  it('defaults a missing id/type to COMP-?/ITEM rather than leaking undefined', () => {
    const out = formatComplianceContextSummary([{ text: 'unlabeled retention rule' }]);
    expect(out).toContain('COMP-?');
    expect(out).toContain('[ITEM]');
    expect(out).toContain('unlabeled retention rule');
    expect(out).not.toContain('undefined');
  });
});
