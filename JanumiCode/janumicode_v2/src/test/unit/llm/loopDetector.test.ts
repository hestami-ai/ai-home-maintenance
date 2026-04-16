/**
 * Regression tests for the streaming-loop detector.
 *
 * Catches the qwen3 thinking-mode pathology where the model produces
 * fluent tokens that cycle through the same self-correction phrase
 * without converging. Idle-stall detection misses this case (chunks
 * ARE arriving — just semantically stuck), so we need a token-content
 * detector that can trip an abort signal.
 */

import { describe, it, expect } from 'vitest';
import { LoopDetector } from '../../../lib/llm/invocationLogger';

describe('LoopDetector', () => {
  it('does not fire during warmup even when text repeats', () => {
    // Default warmup is 8KB; short streams should never trip.
    const det = new LoopDetector(20, 4096, 5, 8192);
    let trigger: string | null = null;
    for (let i = 0; i < 50; i++) {
      const r = det.observe('Wait, let me check that. ');
      if (r) trigger = r;
    }
    expect(trigger).toBeNull();
  });

  it('fires when a repeated phrase saturates the post-warmup buffer', () => {
    // Warmup small to test the loop logic itself.
    const det = new LoopDetector(30, 4096, 5, 100);
    // Pad past warmup with non-repeating filler.
    for (let i = 0; i < 50; i++) {
      const r = det.observe(`unique chunk number ${i.toString().padStart(3, '0')} `);
      // Filler is pseudo-unique; should not trip.
      if (r) {
        throw new Error(`unexpected trip during filler: ${r}`);
      }
    }
    // Now hammer the same 30+ char phrase.
    let trigger: string | null = null;
    for (let i = 0; i < 30; i++) {
      const r = det.observe('Wait, I need to check this once more. ');
      if (r) {
        trigger = r;
        break;
      }
    }
    expect(trigger).not.toBeNull();
    expect(trigger!).toContain('Loop suspected');
    // The reported "recent" window is whichever 30 chars the detector
    // saw last when it tripped — could be any slice of the loop. We
    // just verify it carries part of the repeated phrase.
    expect(trigger!).toMatch(/check|once more|need to/);
  });

  it('does not fire on coherent non-repeating prose past warmup', () => {
    const det = new LoopDetector(50, 4096, 6, 100);
    const lorem = [
      'The product description outlines a multi-tenant platform.',
      'Three pillars are explicitly enumerated in the document.',
      'Phasing strategy implies an incremental rollout approach.',
      'Common Data Model spans accounting, workflow, and governance domains.',
      'Row-level security is required for tenant isolation.',
      'DBOS is mentioned as the workflow durability layer.',
      'oRPC handles inter-service contracts with code-generated clients.',
      'SvelteKit is the chosen frontend framework.',
      'Bun runs both server and edge workloads.',
      'PostgreSQL is the primary data store.',
    ];
    let trigger: string | null = null;
    for (const line of lorem) {
      const r = det.observe(line + ' ');
      if (r) trigger = r;
    }
    expect(trigger).toBeNull();
  });

  it('handles many small chunks (token-by-token streaming)', () => {
    const det = new LoopDetector(30, 4096, 5, 100);
    // Warmup with garbage tokens.
    const garbage = 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(5);
    for (const ch of garbage) det.observe(ch);

    // Now stream the loop one character at a time.
    const phrase = 'Wait, let me check that one more time. ';
    let trigger: string | null = null;
    outer: for (let r = 0; r < 30; r++) {
      for (const ch of phrase) {
        const t = det.observe(ch);
        if (t) { trigger = t; break outer; }
      }
    }
    expect(trigger).not.toBeNull();
  });

  it('returns null on empty input', () => {
    const det = new LoopDetector();
    expect(det.observe('')).toBeNull();
  });
});
