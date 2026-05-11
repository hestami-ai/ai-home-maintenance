/**
 * CLV entry lint — structural checks on entries before they reach the DB.
 *
 * Per Wave 1 gate criterion: "every entry passes lint."
 *
 * Rules:
 *   L1  termId format: clv.<scope>.<name>.<version>
 *   L2  scope must match termId scope token
 *   L3  versioned termId must match version field
 *   L4  no termId duplication within a batch
 *   L5  prohibitedSynonyms must not include the entry's own canonicalName
 *   L6  allowedSynonyms and prohibitedSynonyms must be disjoint within the entry
 *   L7  oneLineDefinition and longDefinition must be non-empty
 *   L8  collisionsWith entries must reference plausible termIds (clv.* prefix)
 *   L9  jurisdictionVariants keys must be uppercase 2-letter codes (MD, VA, PA, DC, US, etc.)
 *   L10 supersedes (if set) must be a different termId
 */

import type { CanonicalVocabularyEntry } from './types.js';

export interface LintFinding {
  rule: string;
  termId: string;
  message: string;
}

const TERM_ID_RE = /^clv\.([a-z_]+)\.([a-z0-9_]+)\.(v\d+)$/;
const JURISDICTION_KEY_RE = /^[A-Z]{2,3}$/;

export function lintEntries(entries: readonly CanonicalVocabularyEntry[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    if (seen.has(e.termId)) {
      findings.push({ rule: 'L4', termId: e.termId, message: 'duplicate termId in batch' });
      continue;
    }
    seen.add(e.termId);

    const m = TERM_ID_RE.exec(e.termId);
    if (!m) {
      findings.push({ rule: 'L1', termId: e.termId, message: `termId does not match clv.<scope>.<name>.<version>` });
      continue;
    }
    const scopeToken = m[1];
    const version = m[3];

    // L2: scope token in termId must align with the entry's scope field for core/firm; for practice_area and jurisdiction
    // the scopeToken often encodes the qualifier (e.g., clv.family_law.x.v1) rather than the literal string 'practice_area'.
    if (e.scope === 'core' && scopeToken !== 'core') {
      findings.push({ rule: 'L2', termId: e.termId, message: `scope=core but termId scope token is '${scopeToken}'` });
    }
    if (e.scope === 'firm' && !scopeToken.startsWith('firm_')) {
      findings.push({ rule: 'L2', termId: e.termId, message: `scope=firm but termId scope token does not start with 'firm_'` });
    }

    // L3
    if (version !== e.version) {
      findings.push({ rule: 'L3', termId: e.termId, message: `termId version ${version} != entry.version ${e.version}` });
    }

    // L5
    const lowerCanon = e.canonicalName.toLowerCase();
    if (e.prohibitedSynonyms.some((s) => s.toLowerCase() === lowerCanon)) {
      findings.push({
        rule: 'L5',
        termId: e.termId,
        message: `canonicalName '${e.canonicalName}' appears in prohibitedSynonyms`,
      });
    }

    // L6
    const allowed = new Set(e.allowedSynonyms.map((s) => s.toLowerCase()));
    for (const p of e.prohibitedSynonyms) {
      if (allowed.has(p.toLowerCase())) {
        findings.push({
          rule: 'L6',
          termId: e.termId,
          message: `'${p}' is in both allowedSynonyms and prohibitedSynonyms`,
        });
      }
    }

    // L7
    if (!e.oneLineDefinition.trim()) {
      findings.push({ rule: 'L7', termId: e.termId, message: 'oneLineDefinition empty' });
    }
    if (!e.longDefinition.trim()) {
      findings.push({ rule: 'L7', termId: e.termId, message: 'longDefinition empty' });
    }

    // L8
    for (const c of e.collisionsWith ?? []) {
      if (!c.startsWith('clv.')) {
        findings.push({ rule: 'L8', termId: e.termId, message: `collisionsWith entry '${c}' is not a clv.* termId` });
      }
    }

    // L9
    for (const k of Object.keys(e.jurisdictionVariants ?? {})) {
      if (!JURISDICTION_KEY_RE.test(k)) {
        findings.push({ rule: 'L9', termId: e.termId, message: `jurisdictionVariants key '${k}' is not 2-3 uppercase letters` });
      }
    }

    // L10
    if (e.supersedes && e.supersedes === e.termId) {
      findings.push({ rule: 'L10', termId: e.termId, message: `supersedes references itself` });
    }
  }

  return findings;
}
