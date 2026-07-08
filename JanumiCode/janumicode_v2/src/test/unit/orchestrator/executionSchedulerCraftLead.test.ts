/**
 * PD-1 (P9 prompt audit, cal-40) — the verbatim `<engineering_constitution>` doc
 * was inlined into every leaf executor prompt (~27.5K chars = 45-66% of the
 * ~60K prompt), drowning the leading write-scope/task directives without changing
 * behavior (craft is advisory + verified at Phase 10). It was replaced by the
 * actionable 5-bullet EXECUTOR_CRAFT_LEAD covering its three topics. These tests
 * pin the shape so the dump cannot silently return and all three topics survive.
 */
import { describe, it, expect } from 'vitest';
import { EXECUTOR_CRAFT_LEAD, buildExecutionModeDirective } from '../../../lib/orchestrator/executionScheduler';

describe('EXECUTOR_CRAFT_LEAD (PD-1)', () => {
  it('has exactly 5 actionable bullets', () => {
    expect((EXECUTOR_CRAFT_LEAD.match(/^- /gm) || []).length).toBe(5);
  });
  it('covers all three constitution topics — comments, observability, testing', () => {
    expect(EXECUTOR_CRAFT_LEAD).toMatch(/doc comment/i);
    expect(EXECUTOR_CRAFT_LEAD).toMatch(/observability/i);
    expect(EXECUTOR_CRAFT_LEAD).toMatch(/\btests?\b/i);
  });
  it('keeps the CC/AC/constraint grounding + Phase-10 verification anchor', () => {
    expect(EXECUTOR_CRAFT_LEAD).toMatch(/CC-001/);
    expect(EXECUTOR_CRAFT_LEAD).toMatch(/Phase-10/);
  });
  it('is compact — NOT the ~27.5K verbatim dump, and carries no dump tag', () => {
    expect(EXECUTOR_CRAFT_LEAD).not.toContain('<engineering_constitution>');
    expect(EXECUTOR_CRAFT_LEAD.length).toBeLessThan(3000);
  });
});

describe('buildExecutionModeDirective (governed RPI autonomy — supersedes PD-10 headless)', () => {
  const attended = buildExecutionModeDirective(true);
  const headless = buildExecutionModeDirective(false);

  it('BOTH modes mandate Research-Plan-Implement — reading the codebase is ALLOWED (no headless no-crawl)', () => {
    for (const d of [attended, headless]) {
      expect(d).toMatch(/research/i);
      expect(d).toMatch(/read the existing workspace|read beyond|investigate/i);
      expect(d).not.toMatch(/do NOT (crawl|probe)/i); // the old headless ban is gone in both
    }
  });
  it('BOTH affirm the write scope / layout is authoritative and forbid deadlocking', () => {
    for (const d of [attended, headless]) {
      expect(d).toMatch(/authoritative/i);
      expect(d).toMatch(/never stall|keep moving|rather than pausing/i);
    }
  });
  it('ATTENDED frames a voice-of-intent reviewer that escalates a clarification to a HUMAN', () => {
    expect(attended).toMatch(/voice-of-intent|reviewer/i);
    expect(attended).toMatch(/clarif/i);
    expect(attended).toMatch(/escalates to a human/i);
  });
  it('HEADLESS states there is NO human and mandates spec-consistent best judgment, no shortcuts', () => {
    expect(headless).toMatch(/headless/i);
    expect(headless).toMatch(/no human/i);
    expect(headless).toMatch(/best spec-consistent|best.*judgment/i);
    expect(headless).toMatch(/no shortcuts/i);
    // must NOT promise a human will answer (there is none in a calibration/CI run)
    expect(headless).not.toMatch(/escalates to a human/i);
  });
  it('both are compact (a lead directive, not a wall of text)', () => {
    expect(attended.length).toBeLessThan(1300);
    expect(headless.length).toBeLessThan(1300);
  });
});
