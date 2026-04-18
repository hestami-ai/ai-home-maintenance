/**
 * Unit tests for the Phase 1.3 interpretation-assumption mirror builder.
 *
 * Before the lens refactor, Phase 1.3's Mirror and Menu both rendered the
 * candidate_product_concepts array — so the human couldn't reject a
 * framing assumption without also rejecting a candidate. These tests pin
 * the contract of the new builder:
 *
 *   - A lens classification ALWAYS becomes the first Mirror row so the
 *     human can see (and reject) the top-level "I treated this as a
 *     product intent" framing before looking at candidates.
 *   - Assumptions that appear in ≥ 2 candidates ARE surfaced as
 *     cross-cutting framing; assumptions unique to one candidate are
 *     NOT (those belong on the candidate card in the Menu).
 *   - When the classified lens differs from the active lens (fallback
 *     because templates for that lens haven't shipped), the Mirror row
 *     text tells the human which lens is actually driving downstream.
 */

import { describe, it, expect } from 'vitest';
import { buildInterpretationMirror } from '../../../lib/orchestrator/phases/phase1/buildInterpretationMirror';

describe('buildInterpretationMirror', () => {
  const baseInputs = {
    classifiedLens: 'product' as const,
    activeLens: 'product' as const,
    lensRationale: 'The intent says "build a platform for property owners" — clear product framing.',
    candidates: [],
    scopeSummary: 'single_product, production_grade',
    complianceSummary: 'No compliance regimes',
  };

  it('emits a lens row first with the classifier rationale as its body', () => {
    const items = buildInterpretationMirror(baseInputs);

    expect(items[0]).toMatchObject({
      id: 'lens-assumption',
      category: 'lens',
    });
    expect(items[0].text).toMatch(/product/);
    expect(items[0].rationale).toContain('property owners');
  });

  it('flags the fallback in the lens row when active lens differs from classified lens', () => {
    const items = buildInterpretationMirror({
      ...baseInputs,
      classifiedLens: 'infra',
      activeLens: 'product',
      lensRationale: 'Deploy / k8s language.',
    });

    expect(items[0].category).toBe('lens');
    expect(items[0].text).toMatch(/infra/);
    expect(items[0].text).toMatch(/product/);
    expect(items[0].text).toMatch(/haven't shipped/);
  });

  it('surfaces scope framing when non-empty', () => {
    const items = buildInterpretationMirror(baseInputs);
    expect(items.some(i => i.id === 'scope-framing')).toBe(true);
  });

  it('drops compliance framing when the summary is "No compliance regimes"', () => {
    const items = buildInterpretationMirror(baseInputs);
    expect(items.some(i => i.id === 'compliance-framing')).toBe(false);
  });

  it('surfaces assumptions shared across ≥ 2 candidates but hides single-candidate ones', () => {
    const items = buildInterpretationMirror({
      ...baseInputs,
      candidates: [
        {
          id: 'c1',
          assumptions: [
            { assumption: 'V1 targets organizational buyers', basis: 'Stated in pillars' },
            { assumption: 'Uses Django backend', basis: 'Unique to this framing' },
          ],
          constraints: [],
          open_questions: [],
        },
        {
          id: 'c2',
          assumptions: [
            { assumption: 'V1 targets organizational buyers', basis: 'Same implication' },
            { assumption: 'Mobile-first UX', basis: 'Unique to c2' },
          ],
          constraints: [],
          open_questions: [],
        },
      ],
    });

    const sharedRow = items.find(i => i.text.includes('organizational buyers'));
    expect(sharedRow).toBeDefined();
    expect(sharedRow!.rationale).toMatch(/2 candidates/);

    expect(items.find(i => i.text.includes('Django'))).toBeUndefined();
    expect(items.find(i => i.text.includes('Mobile-first'))).toBeUndefined();
  });

  it('categorizes anti-goal wording correctly', () => {
    const items = buildInterpretationMirror({
      ...baseInputs,
      candidates: [
        {
          id: 'c1',
          assumptions: [{ assumption: 'V1 is not a marketplace', basis: 'A' }],
          constraints: [],
          open_questions: [],
        },
        {
          id: 'c2',
          assumptions: [{ assumption: 'V1 is not a marketplace', basis: 'B' }],
          constraints: [],
          open_questions: [],
        },
      ],
    });

    const row = items.find(i => i.text.includes('marketplace'));
    expect(row).toBeDefined();
    expect(row!.category).toBe('anti_goal');
  });
});
