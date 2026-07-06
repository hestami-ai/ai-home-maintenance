/**
 * PD-6 (P9 prompt audit) — the per-task DMR context is inlined into every leaf
 * prompt (the sandbox can't read the on-disk copy, slice-151), but with
 * `scopeTier:'all_runs'` a cross-run whole-catalog dump could dominate the prompt
 * as dead context. `capInlinedDmrContext` budget-caps it with a materiality-ordered
 * TAIL-drop at blank-line section boundaries — never clipping mid-structure, always
 * keeping the most-material (head) sections. These tests pin those invariants.
 */
import { describe, it, expect } from 'vitest';
import { capInlinedDmrContext, stripRedundantDetailHeader } from '../../../lib/orchestrator/executionContextBuilder';

// Build N blank-line-separated sections; each ~120 chars so the budget bites.
const sections = (n: number) =>
  Array.from({ length: n }, (_, i) => `### Finding ${i}\n${'x'.repeat(110)}`).join('\n\n');

describe('capInlinedDmrContext (PD-6)', () => {
  it('returns short content unchanged (no note)', () => {
    const small = sections(2);
    expect(capInlinedDmrContext(small, 12000)).toBe(small);
    expect(capInlinedDmrContext(small, 12000)).not.toContain('elided');
  });

  it('over budget: keeps the HEAD sections, drops the tail, notes the count', () => {
    const many = sections(60); // ~7.3K; force elision with a tiny budget
    const out = capInlinedDmrContext(many, 600);
    expect(out).toContain('### Finding 0');           // most-material head kept
    expect(out).toMatch(/… \(\d+ lower-materiality Deep-Memory section\(s\) elided/);
    expect(out).not.toContain('### Finding 59');       // least-material tail dropped
    expect(out.length).toBeLessThan(many.length);
  });

  it('NEVER clips mid-section — every kept block is a COMPLETE original section', () => {
    const many = sections(60);
    const originals = new Set(many.split('\n\n'));
    const out = capInlinedDmrContext(many, 600);
    // strip the trailing elision note, then every remaining block must be intact.
    const body = out.replace(/\n\n… \(.*$/s, '');
    for (const block of body.split('\n\n')) {
      expect(originals.has(block)).toBe(true); // no severed/partial block
    }
  });

  it('keeps a single over-budget section whole (never drops everything)', () => {
    const one = `### Only\n${'y'.repeat(20000)}`;
    const out = capInlinedDmrContext(one, 600);
    expect(out).toBe(one);            // kept intact
    expect(out).not.toContain('elided');
  });

  it('passes non-string through untouched', () => {
    expect(capInlinedDmrContext(undefined as unknown as string, 600)).toBe(undefined);
  });
});

describe('stripRedundantDetailHeader (PD-11)', () => {
  it('removes the inner "# JanumiCode Context Detail File" H1 so the template header is the only one', () => {
    const body = '# JanumiCode Context Detail File\n\n## Task Implementation Bundle\n\ncontent here';
    const out = stripRedundantDetailHeader(body);
    expect(out).not.toContain('# JanumiCode Context Detail File');
    expect(out.startsWith('## Task Implementation Bundle')).toBe(true);
  });

  it('is a no-op when the redundant title is absent', () => {
    const body = '## Task Implementation Bundle\n\ncontent';
    expect(stripRedundantDetailHeader(body)).toBe(body);
    expect(stripRedundantDetailHeader('(detail file unavailable)')).toBe('(detail file unavailable)');
  });
});
