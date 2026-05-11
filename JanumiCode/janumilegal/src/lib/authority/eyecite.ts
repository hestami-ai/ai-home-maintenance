/**
 * Eyecite-pattern citation parser (regex-based, no network).
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.2:
 *   "Citator provider abstraction; MVP wires Eyecite (extraction)..."
 *
 * Wave 6 ships an in-process citation parser sufficient for mechanical
 * checks on the gold matter and similar Maryland-shaped citations. Wave 7+
 * may swap in the actual Eyecite Python service via subprocess or a
 * compiled WASM build of Eyecite.
 *
 * The parser is intentionally permissive: it returns parseOk=true if it can
 * extract a recognizable shape, and surfaces parse notes in `parseErrors`.
 */

import type { ParsedCitation } from './types.js';

// US case-law citation: "499 U.S. 340 (1991)"  — vol reporter page (year).
// Year is required when parens present; court name is optional within parens.
const US_CASE_RE = /^\s*(\d+)\s+([A-Za-z.\s]+?)\s+(\d+)(?:\s*\((?:([^)]+?)\s+)?(\d{4})\))?\s*$/;
// MD code section: "Md. Code Ann., Fam. Law § 9-105"
const MD_STATUTE_RE = /Md\.?\s+Code\s+Ann\.?,?\s+([A-Z][A-Za-z.\s]+?)\s*§\s*([\d-]+(?:\.\d+)?)/i;
// MD Rule: "MD Rule 19-301.7" / "Md. Rule 19-301.7"
const MD_RULE_RE = /(?:MD|Md\.?)\s+Rule\s+([\d-]+(?:\.\d+)?)/i;
// Federal rule: "Fed. R. Civ. P. 11"
const FED_RULE_RE = /Fed\.?\s+R\.?\s+(?:Civ|Crim|Evid|App)\.?\s*P\.?\s*([\d.]+)/i;

export function parseCitation(raw: string): ParsedCitation {
  const trimmed = raw.trim();

  // MD statute
  const md = MD_STATUTE_RE.exec(trimmed);
  if (md) {
    return {
      raw,
      statuteSection: md[2],
      parseOk: true,
    };
  }

  // MD rule
  const mr = MD_RULE_RE.exec(trimmed);
  if (mr) {
    return { raw, ruleNumber: `MD Rule ${mr[1]}`, parseOk: true };
  }

  // Federal rule
  const fr = FED_RULE_RE.exec(trimmed);
  if (fr) {
    return { raw, ruleNumber: `Fed. R. ${fr[1]}`, parseOk: true };
  }

  // US case
  const cs = US_CASE_RE.exec(trimmed);
  if (cs) {
    return {
      raw,
      volume: cs[1],
      reporter: cs[2].trim(),
      page: cs[3],
      court: cs[4]?.trim(),
      year: cs[5],
      parseOk: true,
    };
  }

  return { raw, parseOk: false, parseErrors: ['no recognized citation pattern matched'] };
}

/** Extract all citation candidates from a free-text string. */
export function extractCitations(text: string): readonly ParsedCitation[] {
  const candidates: ParsedCitation[] = [];
  // Naïve splitter: pull common citation shapes via the same patterns.
  const patterns = [MD_STATUTE_RE, MD_RULE_RE, FED_RULE_RE, US_CASE_RE];
  for (const re of patterns) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      const parsed = parseCitation(m[0]);
      if (parsed.parseOk) candidates.push(parsed);
      if (m.index === g.lastIndex) g.lastIndex++; // safety
    }
  }
  return candidates;
}
