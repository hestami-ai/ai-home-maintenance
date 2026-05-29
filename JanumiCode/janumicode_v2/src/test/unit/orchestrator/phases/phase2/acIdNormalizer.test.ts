/**
 * Phase 2 AC id normalizer — mints workflow-globally-unique composite
 * AC ids `AC-US{nnn}-{mmm}` so downstream consumers can join via
 * exact-string membership instead of per-story scoping logic.
 */

import { describe, it, expect } from 'vitest';
import {
  mintCompositeAcIds,
  parseCompositeAcId,
  parentRefFromCompositeAc,
} from '../../../../../lib/orchestrator/phases/phase2/acIdNormalizer';

describe('mintCompositeAcIds', () => {
  it('rewrites per-story AC-001 counters to composite form encoding the parent story', () => {
    const stories = [
      { id: 'US-001', acceptance_criteria: [{ id: 'AC-001' }, { id: 'AC-002' }] },
      { id: 'US-002', acceptance_criteria: [{ id: 'AC-001' }, { id: 'AC-002' }, { id: 'AC-003' }] },
    ];
    const r = mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-US001-001', 'AC-US001-002']);
    expect(stories[1].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-US002-001', 'AC-US002-002', 'AC-US002-003']);
    expect(r.minted).toBe(5);
    expect(r.preserved).toBe(0);
    expect(r.skippedStoryIds).toEqual([]);
  });

  it('mints positionally — id depends on the AC index, not the LLM-emitted id', () => {
    // LLM emitted ids out of order / with gaps. The normalizer
    // ignores them and assigns positionally.
    const stories = [
      { id: 'US-005', acceptance_criteria: [
        { id: 'AC-009' },
        { id: 'AC-002' },
        { id: 'AC-foo' },
      ]},
    ];
    mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-US005-001', 'AC-US005-002', 'AC-US005-003']);
  });

  it('is idempotent: re-running preserves composite ids and continues the counter for new ACs', () => {
    const stories = [
      { id: 'US-001', acceptance_criteria: [{ id: 'AC-001' }, { id: 'AC-002' }] },
    ];
    mintCompositeAcIds(stories);
    // Now an enrichment pass appends two new ACs (with LLM-style ids).
    stories[0].acceptance_criteria.push({ id: 'AC-003' }, { id: 'AC-extra' });
    const r2 = mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-US001-001', 'AC-US001-002', 'AC-US001-003', 'AC-US001-004']);
    expect(r2.preserved).toBe(2);
    expect(r2.minted).toBe(2);
  });

  it('advances counter past the highest-existing composite even when middle slots are missing', () => {
    // Simulates a stitched / merged story where existing composite
    // ids skip — e.g. AC-US001-001, AC-US001-005, then a new AC. The
    // new AC should land at AC-US001-006, not collide.
    const stories = [
      { id: 'US-001', acceptance_criteria: [
        { id: 'AC-US001-001' },
        { id: 'AC-US001-005' },
        { id: 'AC-new' },
      ]},
    ];
    mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-US001-001', 'AC-US001-005', 'AC-US001-006']);
  });

  it('uses verbatim story-id as anchor for non-US story shapes (saturation leaves)', () => {
    // Saturation children have ids like `FR-URL-CREATION-1`, `US-002-atomic`,
    // `FR-DELETE-URL-1.1`. The normalizer falls through to a verbatim-anchor
    // prefix `AC-{story.id}-NNN`, giving each leaf its own AC namespace.
    const stories = [
      { id: 'FR-URL-CREATION-1', acceptance_criteria: [{ id: 'AC-001' }, { id: 'AC-URL-ENCRYPTION-1' }] },
      { id: 'US-002-atomic', acceptance_criteria: [{ id: 'AC-002' }] },
      { id: 'FR-DELETE-URL-1.1', acceptance_criteria: [{ id: 'AC-001' }, { id: 'AC-002' }] },
      { id: 'US-007', acceptance_criteria: [{ id: 'AC-001' }] }, // canonical path
    ];
    const r = mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-FR-URL-CREATION-1-001', 'AC-FR-URL-CREATION-1-002']);
    expect(stories[1].acceptance_criteria[0].id).toBe('AC-US-002-atomic-001');
    expect(stories[2].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-FR-DELETE-URL-1.1-001', 'AC-FR-DELETE-URL-1.1-002']);
    expect(stories[3].acceptance_criteria[0].id).toBe('AC-US007-001'); // canonical
    expect(r.skippedStoryIds).toEqual([]);
    expect(r.minted).toBe(6);
  });

  it('idempotent on saturation-leaf composite ids (preserves AC-{anchor}-NNN, extends counter)', () => {
    const stories = [
      { id: 'FR-URL-CREATION-1', acceptance_criteria: [
        { id: 'AC-FR-URL-CREATION-1-001' },
        { id: 'AC-FR-URL-CREATION-1-002' },
        { id: 'NEW' },
      ]},
    ];
    const r = mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria.map(ac => ac.id))
      .toEqual(['AC-FR-URL-CREATION-1-001', 'AC-FR-URL-CREATION-1-002', 'AC-FR-URL-CREATION-1-003']);
    expect(r.preserved).toBe(2);
    expect(r.minted).toBe(1);
  });

  it('skips story-ids containing unsafe characters (whitespace, punctuation)', () => {
    const stories = [
      { id: 'has space', acceptance_criteria: [{ id: 'AC-001' }] },
      { id: 'has/slash', acceptance_criteria: [{ id: 'AC-001' }] },
      { id: 'safe-id_v1.2', acceptance_criteria: [{ id: 'AC-001' }] },
    ];
    const r = mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria[0].id).toBe('AC-001');
    expect(stories[1].acceptance_criteria[0].id).toBe('AC-001');
    expect(stories[2].acceptance_criteria[0].id).toBe('AC-safe-id_v1.2-001');
    expect([...r.skippedStoryIds].sort((a, b) => a.localeCompare(b))).toEqual(['has space', 'has/slash']);
  });

  it('handles empty / missing acceptance_criteria gracefully', () => {
    const stories = [
      { id: 'US-001' },
      { id: 'US-002', acceptance_criteria: [] },
      { id: 'US-003', acceptance_criteria: null as unknown },
    ];
    const r = mintCompositeAcIds(stories);
    expect(r.minted).toBe(0);
    expect(r.preserved).toBe(0);
  });

  it('preserves zero-padding to 3 digits even when story numbers are large', () => {
    const stories = [{ id: 'US-042', acceptance_criteria: [{ id: 'x' }] }];
    mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria[0].id).toBe('AC-US042-001');
  });

  it('preserves story-id numeric prefix even when story-side uses leading zeros differently', () => {
    // US-007 vs US-7 — only US-007 (matching the canonical Phase 2 shape) is minted against.
    const stories = [
      { id: 'US-7', acceptance_criteria: [{ id: 'AC-001' }] },
      { id: 'US-007', acceptance_criteria: [{ id: 'AC-001' }] },
    ];
    const r = mintCompositeAcIds(stories);
    expect(stories[0].acceptance_criteria[0].id).toBe('AC-US7-001');
    expect(stories[1].acceptance_criteria[0].id).toBe('AC-US007-001');
    expect(r.skippedStoryIds).toEqual([]);
  });
});

describe('parseCompositeAcId', () => {
  it('parses composite ids back to (storyId, ordinal)', () => {
    expect(parseCompositeAcId('AC-US001-001')).toEqual({ storyId: 'US-001', ordinal: 1 });
    expect(parseCompositeAcId('AC-US042-007')).toEqual({ storyId: 'US-042', ordinal: 7 });
  });

  it('returns null for legacy non-composite ids', () => {
    expect(parseCompositeAcId('AC-001')).toBeNull();
    expect(parseCompositeAcId('AC-URL-001')).toBeNull();
    expect(parseCompositeAcId('US-001')).toBeNull();
    expect(parseCompositeAcId('')).toBeNull();
  });
});

describe('parentRefFromCompositeAc', () => {
  it('extracts US-{nnn} root from compact canonical form', () => {
    expect(parentRefFromCompositeAc('AC-US001-001')).toBe('US-001');
    expect(parentRefFromCompositeAc('AC-US042-007')).toBe('US-042');
  });

  it('extracts verbatim leaf id from verbatim-anchor form', () => {
    // Saturation leaves use the leaf's own id as the AC anchor.
    expect(parentRefFromCompositeAc('AC-FR-CAM-1.1-001')).toBe('FR-CAM-1.1');
    expect(parentRefFromCompositeAc('AC-US-004-AUTH-D1-002')).toBe('US-004-AUTH-D1');
    expect(parentRefFromCompositeAc('AC-FR-URL-CREATION-1-005')).toBe('FR-URL-CREATION-1');
    expect(parentRefFromCompositeAc('AC-NFR-AES-256-1-001')).toBe('NFR-AES-256-1');
  });

  it('handles leaf ids containing dots and underscores', () => {
    expect(parentRefFromCompositeAc('AC-FR-ARCHIVE-1.1-003')).toBe('FR-ARCHIVE-1.1');
    expect(parentRefFromCompositeAc('AC-safe_id-001')).toBe('safe_id');
  });

  it('returns null for non-composite refs', () => {
    expect(parentRefFromCompositeAc('AC-001')).toBeNull();      // no trailing -NNN composite
    expect(parentRefFromCompositeAc('US-001')).toBeNull();      // wrong prefix
    expect(parentRefFromCompositeAc('AC-NO-DIGITS')).toBeNull();
    expect(parentRefFromCompositeAc('')).toBeNull();
  });
});
