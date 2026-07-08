/**
 * Deterministic validator: responsibility_atomicity_validator
 *
 * Per validator_catalog.md §3 (Phase 4.2 bloom-class, sample 19):
 * Detect compound responsibility statements (CM-001 conjunction violations)
 * in component descriptions. Scans responsibility strings for 'X AND Y' or
 * 'X, Y, and Z' patterns implying hidden sub-component scope.
 *
 * The CM-001 invariant: each responsibility statement should express a single
 * cohesive concern. Conjunction patterns ("stores X AND manages Y") suggest
 * the component has two distinct concerns that should be split into separate
 * components or surfaced as a sub-bloom.
 *
 * Severity: MEDIUM per offending statement.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

// Detects compound responsibility statements.
// Examples:
//   "stores property records AND manages ownership history"
//   "validates payments, generates invoices, and sends notifications"
const CONJUNCTION_RE = /\b(and|AND)\b.*\b(and|AND)\b|\b\w+s?\s+(and|AND)\s+\w+s?\b/;
const OXFORD_COMMA_RE = /,\s*\w+(?:s)?,\s+and\s+\w+/i;

function isCompound(statement: string): boolean {
  // Require the pattern to contain a verb-like word before and after the conjunction.
  // Simple check: "verb-word AND verb-word" or "noun, noun, and noun"
  if (OXFORD_COMMA_RE.test(statement)) return true;
  // "manages X and Y" or "handles A, B, and C"
  if (/\b(manages?|handles?|stores?|processes?|validates?|generates?|tracks?|sends?|creates?|maintains?|provides?)\b.*\band\b.*\b(manages?|handles?|stores?|processes?|validates?|generates?|tracks?|sends?|creates?|maintains?|provides?)\b/i.test(statement)) {
    return true;
  }
  return false;
}

export function validateResponsibilityAtomicity(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent } = params;
  if (!outputContent) return [];

  // Look for component model arrays — may be 'components', 'component_model', etc.
  const components =
    (outputContent.components as unknown[]) ??
    (outputContent.component_model as unknown[]) ??
    (outputContent.component_skeleton as unknown[]) ??
    null;
  if (!Array.isArray(components)) return [];

  const findings: ValidatorFinding[] = [];

  components.forEach((comp, idx) => {
    if (!comp || typeof comp !== 'object') return;
    const c = comp as Record<string, unknown>;
    let compId: string;
    if (typeof c.id === 'string') {
      compId = c.id;
    } else if (typeof c.component_id === 'string') {
      compId = c.component_id;
    } else {
      compId = `index ${idx}`;
    }

    let responsibilities: unknown[];
    if (Array.isArray(c.responsibilities)) {
      responsibilities = c.responsibilities;
    } else if (Array.isArray(c.responsibility)) {
      responsibilities = c.responsibility;
    } else if (typeof c.responsibility_statement === 'string') {
      responsibilities = [c.responsibility_statement];
    } else {
      responsibilities = [];
    }

    responsibilities.forEach((resp, rIdx) => {
      const text = typeof resp === 'string' ? resp : (resp as Record<string, unknown>)?.statement as string ?? '';
      if (!text) return;

      if (isCompound(text)) {
        findings.push({
          validatorId: 'responsibility_atomicity_validator',
          severity: 'MEDIUM',
          type: 'compound_responsibility',
          summary: `Component '${compId}' has compound responsibility statement (CM-001 violation)`,
          location: `$.components[${idx}].responsibilities[${rIdx}]`,
          detail: `Responsibility "${text.slice(0, 120)}" contains conjunction pattern suggesting two or more distinct concerns.`,
          recommendation: `Split into separate components, each with a single atomic concern, or surface a sub-bloom to decompose the component further.`,
        });
      }
    });
  });

  return findings;
}
