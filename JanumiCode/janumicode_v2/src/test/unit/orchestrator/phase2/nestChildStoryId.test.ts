/**
 * Unit tests for `nestChildStoryId` (Phase 2 saturation leaf-id drift repair).
 *
 * Covers the ts-119 upstream fix: the decomposer LLM occasionally drifts a
 * child id to an unrelated namespace (parent `US-001` → child
 * `FR-URL-SHORTEN-1.1`), severing the string path packet_synthesis walks to
 * match a leaf to its canonical user story / NFRs. This helper forces every
 * child id to nest under its parent (`US-001` → `US-001-1` → `US-001-1-1`)
 * while preserving already-conforming LLM ids and de-colliding siblings.
 */

import { describe, it, expect } from 'vitest';
import { nestChildStoryId } from '../../../../lib/orchestrator/phases/phase2';

describe('nestChildStoryId — saturation leaf-id drift repair', () => {
  it('keeps a conforming LLM id that already nests under its parent', () => {
    const taken = new Set<string>();
    expect(nestChildStoryId('US-004-1', 'US-004', 1, taken)).toBe('US-004-1');
    expect(nestChildStoryId('NFR-001-001', 'NFR-001', 1, new Set())).toBe('NFR-001-001');
  });

  it('rewrites a drifted FR-named child to nest under its parent', () => {
    const taken = new Set<string>();
    // Real ts-118 topology: parent US-001 → LLM emitted FR-URL-SHORTEN-1.1.
    expect(nestChildStoryId('FR-URL-SHORTEN-1.1', 'US-001', 1, taken)).toBe('US-001-1');
  });

  it('produces a deep nested id when the parent is itself a repaired child', () => {
    // depth-2: parent is the repaired depth-1 node `US-001-1`.
    expect(nestChildStoryId('FR-URL-SHORTEN-1.1', 'US-001-1', 1, new Set())).toBe('US-001-1-1');
  });

  it('de-collides a derived id against a kept LLM sibling id', () => {
    const taken = new Set<string>();
    // First child: LLM emits conforming US-001-1 (kept).
    expect(nestChildStoryId('US-001-1', 'US-001', 1, taken)).toBe('US-001-1');
    // Second child drifts; its index (1) would derive the same US-001-1 →
    // must be de-collided rather than clobber the first sibling.
    const second = nestChildStoryId('FR-OTHER-9', 'US-001', 1, taken);
    expect(second).not.toBe('US-001-1');
    expect(second.startsWith('US-001-1-')).toBe(true);
  });

  it('keeps distinct derived ids unique across multiple drifted siblings', () => {
    const taken = new Set<string>();
    const a = nestChildStoryId('FR-A', 'US-002', 1, taken);
    const b = nestChildStoryId('FR-B', 'US-002', 2, taken);
    const c = nestChildStoryId('FR-C', 'US-002', 3, taken);
    expect(new Set([a, b, c]).size).toBe(3);
    expect([a, b, c]).toEqual(['US-002-1', 'US-002-2', 'US-002-3']);
  });

  it('passes the raw id through unchanged when no parent key is known', () => {
    // Defensive: an empty parent key cannot anchor a nested id.
    expect(nestChildStoryId('US-007-1', '', 1, new Set())).toBe('US-007-1');
  });

  it('leaves children untouched when the parent is OUTSIDE the US/NFR lineage', () => {
    // Generic decomposition trees (FR-named synthetic roots, other
    // namespaces) are not joined by packet_synthesis — repairing them
    // would needlessly churn ids. The gate keeps them verbatim.
    expect(nestChildStoryId('FR-OK', 'FR-ROOT', 1, new Set())).toBe('FR-OK');
    expect(nestChildStoryId('FR-ACCT-1', 'FR-ACCT-0', 1, new Set())).toBe('FR-ACCT-1');
  });

  it('normalizes children of a nested NFR-lineage parent', () => {
    expect(nestChildStoryId('FR-DRIFT', 'NFR-002-001', 2, new Set())).toBe('NFR-002-001-2');
  });
});
