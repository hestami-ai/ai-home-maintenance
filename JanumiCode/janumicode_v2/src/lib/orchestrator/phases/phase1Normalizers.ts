/**
 * Phase 1 extraction normalizers — pure functions, separated from the
 * Phase1Handler class so they can be regression-tested without spinning
 * up the orchestrator. Each normalizer accepts the raw `parsed` array
 * the LLM returned and produces a typed, schema-shaped array, dropping
 * items whose required fields are missing.
 *
 * Why this matters: cal-22b dropped all 21 technical constraints in
 * the Hestami calibration because the LLM-emitted items lacked a `text`
 * field (content was in `rationale` and `source_ref.excerpt`). The
 * normalizer's `text.length > 0` filter then silently discarded every
 * one of them. Downstream phases reinvented Python/FastAPI defaults
 * because the active-constraints channel was empty. Lifting the
 * normalizers here makes the LLM-shape-tolerance behavior explicit and
 * directly testable.
 */

import type { TechnicalConstraint, SourceRef } from '../../types/records';

export function normalizeSourceRef(raw: unknown): SourceRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const document_path = typeof o.document_path === 'string' ? o.document_path : '';
  const excerpt = typeof o.excerpt === 'string' ? o.excerpt : '';
  if (!document_path || !excerpt) return undefined;
  return {
    document_path,
    section_heading: typeof o.section_heading === 'string' ? o.section_heading : undefined,
    excerpt,
    excerpt_start: typeof o.excerpt_start === 'number' ? o.excerpt_start : undefined,
    excerpt_end: typeof o.excerpt_end === 'number' ? o.excerpt_end : undefined,
  };
}

/**
 * Normalize technical-constraints output from Phase 1.0c.
 *
 * Tolerance order for the constraint description text:
 *   1. `text` — the canonical field per the prompt template.
 *   2. `rationale` — qwen3.5-35b-a3b often puts a coherent sentence here
 *      and leaves `text` empty.
 *   3. `source_ref.excerpt` — verbatim source quote; always grounded
 *      when present, since the prompt requires it.
 *   4. `technology` — last-resort fallback (just the named tool).
 *
 * Items still drop if NONE of those fields produce a non-empty string.
 * That preserves the original "drop unfounded captures" intent while
 * not punishing the LLM for routing the description into a sibling
 * field.
 */
export function normalizeTechnicalConstraints(raw: unknown[]): TechnicalConstraint[] {
  return raw.map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const sourceRef = normalizeSourceRef(o.source_ref);
    const text =
      typeof o.text === 'string' && o.text.length > 0 ? o.text
      : typeof o.rationale === 'string' && o.rationale.length > 0 ? o.rationale
      : sourceRef?.excerpt && sourceRef.excerpt.length > 0 ? sourceRef.excerpt
      : typeof o.technology === 'string' && o.technology.length > 0 ? o.technology
      : '';
    return {
      id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `TECH-${i + 1}`,
      category: typeof o.category === 'string' ? o.category : 'uncategorized',
      text,
      technology: typeof o.technology === 'string' ? o.technology : undefined,
      version: typeof o.version === 'string' ? o.version : undefined,
      rationale: typeof o.rationale === 'string' ? o.rationale : undefined,
      source_ref: sourceRef,
    };
  }).filter(t => t.text.length > 0);
}
