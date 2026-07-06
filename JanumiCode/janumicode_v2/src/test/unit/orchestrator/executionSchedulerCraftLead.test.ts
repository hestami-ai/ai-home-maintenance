/**
 * PD-1 (P9 prompt audit, cal-40) — the verbatim `<engineering_constitution>` doc
 * was inlined into every leaf executor prompt (~27.5K chars = 45-66% of the
 * ~60K prompt), drowning the leading write-scope/task directives without changing
 * behavior (craft is advisory + verified at Phase 10). It was replaced by the
 * actionable 5-bullet EXECUTOR_CRAFT_LEAD covering its three topics. These tests
 * pin the shape so the dump cannot silently return and all three topics survive.
 */
import { describe, it, expect } from 'vitest';
import { EXECUTOR_CRAFT_LEAD, HEADLESS_EXECUTION_DIRECTIVE } from '../../../lib/orchestrator/executionScheduler';

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

describe('HEADLESS_EXECUTION_DIRECTIVE (PD-10)', () => {
  it('states the run is headless / non-interactive', () => {
    expect(HEADLESS_EXECUTION_DIRECTIVE).toMatch(/headless|non-interactive/i);
  });
  it('forbids asking questions and probing the tree', () => {
    expect(HEADLESS_EXECUTION_DIRECTIVE).toMatch(/do NOT ask/i);
    expect(HEADLESS_EXECUTION_DIRECTIVE).toMatch(/probe|crawl/i);
  });
  it('affirms the given context is authoritative', () => {
    expect(HEADLESS_EXECUTION_DIRECTIVE).toMatch(/authoritative/i);
  });
  it('is compact (a lead directive, not a wall of text)', () => {
    expect(HEADLESS_EXECUTION_DIRECTIVE.length).toBeLessThan(1200);
  });
});
