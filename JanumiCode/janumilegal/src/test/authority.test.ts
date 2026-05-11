import { describe, it, expect } from 'vitest';
import { parseCitation, extractCitations } from '../lib/authority/eyecite.js';
import { MechanicalCheckRunner, InMemorySourceProvider } from '../lib/authority/mechanicalChecks.js';
import { DeterministicMdCitatorProvider, NullCitatorProvider, CompositeCitator } from '../lib/authority/citator.js';
import { CheckLabeler } from '../lib/authority/labeler.js';
import { DeterministicSupportAssessor } from '../lib/authority/machineAssessedSupport.js';
import type { AuthorityRef } from '../lib/authority/types.js';

describe('Eyecite-pattern parser', () => {
  it('parses MD statute', () => {
    const p = parseCitation('Md. Code Ann., Fam. Law § 9-105');
    expect(p.parseOk).toBe(true);
    expect(p.statuteSection).toBe('9-105');
  });
  it('parses MD rule', () => {
    const p = parseCitation('MD Rule 19-301.7');
    expect(p.parseOk).toBe(true);
    expect(p.ruleNumber).toBe('MD Rule 19-301.7');
  });
  it('parses US case', () => {
    const p = parseCitation('410 U.S. 113 (1973)');
    expect(p.parseOk).toBe(true);
    expect(p.volume).toBe('410');
    expect(p.page).toBe('113');
    expect(p.year).toBe('1973');
  });
  it('returns parseOk=false on garbage', () => {
    expect(parseCitation('not a citation').parseOk).toBe(false);
  });
  it('extracts multiple citations from a paragraph', () => {
    const text = 'Per Md. Code Ann., Fam. Law § 9-105 and Fed. R. Civ. P. 11, the conclusion stands.';
    const c = extractCitations(text);
    expect(c.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Mechanical checks', () => {
  it('source_located = false when authority absent', () => {
    const src = new InMemorySourceProvider();
    const r = new MechanicalCheckRunner(src).check({
      authority: { authorityId: 'X', citation: 'Md. Code Ann., Fam. Law § 9-105', authorityType: 'statute', jurisdiction: 'MD' },
    });
    expect(r.sourceLocated).toBe(false);
  });
  it('source_located + quote_matched succeed when corpus has the text', () => {
    const src = new InMemorySourceProvider();
    src.set('X', 'Father shall have access every other weekend.');
    const r = new MechanicalCheckRunner(src).check({
      authority: { authorityId: 'X', citation: 'Md. Code Ann., Fam. Law § 9-105', authorityType: 'statute', jurisdiction: 'MD' },
      quotedSpan: 'every other weekend',
    });
    expect(r.sourceLocated).toBe(true);
    expect(r.quoteMatched).toBe(true);
  });
});

describe('Citator providers', () => {
  it('null provider returns no_data', () => {
    const ref: AuthorityRef = { authorityId: 'A', citation: 'A', authorityType: 'case_law', jurisdiction: 'MD' };
    expect(new NullCitatorProvider().lookup(ref)).toBeUndefined();
  });
  it('deterministic MD citator returns "real" status for MD jurisdiction', () => {
    const c = new DeterministicMdCitatorProvider([['MD-FAM-CUSTODY-CASE-001', 'good_law']]);
    const r = c.lookup({ authorityId: 'MD-FAM-CUSTODY-CASE-001', citation: 'X', authorityType: 'case_law', jurisdiction: 'MD' });
    expect(r).toBeDefined();
    expect(r!.treatment).toBe('good_law');
    expect(r!.providerName).toBe('deterministic_md_v1');
  });
  it('deterministic MD citator does not return status for non-MD authorities', () => {
    const c = new DeterministicMdCitatorProvider([['X', 'good_law']]);
    expect(c.lookup({ authorityId: 'X', citation: 'X', authorityType: 'case_law', jurisdiction: 'VA' })).toBeUndefined();
  });
  it('composite routes to first hit', () => {
    const a = new NullCitatorProvider();
    const b = new DeterministicMdCitatorProvider([['Y', 'overruled']]);
    const composite = new CompositeCitator([a, b]);
    const r = composite.lookup({ authorityId: 'Y', citation: 'Y', authorityType: 'case_law', jurisdiction: 'MD' });
    expect(r?.treatment).toBe('overruled');
  });
});

describe('Deterministic / Probabilistic Labeler', () => {
  const ref: AuthorityRef = { authorityId: 'A', citation: 'A', authorityType: 'case_law', jurisdiction: 'MD' };
  const lab = new CheckLabeler();

  it('attorney_confirmed wins over everything', () => {
    const r = lab.label({
      authority: ref,
      mechanical: { authorityId: 'A', citationParsed: true, sourceLocated: true, quoteMatched: true, notes: [] },
      machineAssessedSupport: { authorityId: 'A', proposition: 'p', supports: 'supports', confidence: 'high', basis: 'b' },
      machineAssessedTreatment: { authorityId: 'A', treatment: 'good_law', confidence: 'high', basis: 'b' },
      citatorStatus: { authorityId: 'A', treatment: 'good_law', providerName: 'p', retrievedAt: 'now' },
      attorneyConfirmed: { byAttorneyId: 'a1', at: 'now', actionId: 'act1' },
    });
    expect(r.displayLabel).toBe('attorney_confirmed');
    expect(r.attorneyConfirmationRequired).toBe(false);
  });

  it('citator_status wins over machine_assessed_support', () => {
    const r = lab.label({
      authority: ref,
      machineAssessedSupport: { authorityId: 'A', proposition: 'p', supports: 'supports', confidence: 'high', basis: 'b' },
      citatorStatus: { authorityId: 'A', treatment: 'good_law', providerName: 'p', retrievedAt: 'now' },
    });
    expect(r.displayLabel).toBe('citator_status');
    expect(r.attorneyConfirmationRequired).toBe(true); // not attorney-confirmed
  });

  it('mechanical-only goes to source_located / quote_matched', () => {
    const r1 = lab.label({
      authority: ref,
      mechanical: { authorityId: 'A', citationParsed: true, sourceLocated: true, notes: [] },
    });
    expect(r1.displayLabel).toBe('source_located');
    const r2 = lab.label({
      authority: ref,
      mechanical: { authorityId: 'A', citationParsed: true, sourceLocated: true, quoteMatched: true, notes: [] },
    });
    expect(r2.displayLabel).toBe('quote_matched');
  });

  it('default = attorney_confirmation_required', () => {
    const r = lab.label({ authority: ref });
    expect(r.displayLabel).toBe('attorney_confirmation_required');
    expect(r.attorneyConfirmationRequired).toBe(true);
  });
});

describe('Machine-assessed support (deterministic stand-in)', () => {
  it('returns "supports" when authority text and proposition share many tokens', () => {
    const a = new DeterministicSupportAssessor().assess({
      authority: { authorityId: 'A', citation: 'A', authorityType: 'rule', jurisdiction: 'MD' },
      authorityText: 'neither party shall withhold access based on disputes regarding child support',
      proposition: 'a party may not withhold access based on child support disputes',
    });
    expect(['supports', 'partially_supports']).toContain(a.supports);
  });
  it('returns "does_not_support" on disjoint text', () => {
    const a = new DeterministicSupportAssessor().assess({
      authority: { authorityId: 'A', citation: 'A', authorityType: 'rule', jurisdiction: 'MD' },
      authorityText: 'tax depreciation methods for commercial real estate',
      proposition: 'father has access every other weekend',
    });
    expect(a.supports).toBe('does_not_support');
  });
});
