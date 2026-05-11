/**
 * VCC engine.
 *
 * Detects collisions between an existing CLV corpus and a candidate batch
 * being introduced (a lens pack's vocab extensions, a firm config merge,
 * a CLV publish migration, or a matter's combined active vocabulary).
 *
 * Returns a VocabularyCollisionReport with severity-tiered findings and a
 * final verdict. Verdict semantics:
 *   - 'allow'         : no BLOCK and no WARN_ACK; safe to proceed.
 *   - 'allow_with_ack': no BLOCK but at least one WARN_ACK; firm-admin must
 *                       acknowledge before the candidate batch is loaded.
 *   - 'block'         : at least one BLOCK; load is refused.
 */

import { randomUUID } from 'node:crypto';
import type { CanonicalVocabularyEntry } from '../clv/types.js';
import type {
  Collision,
  VccInputBatch,
  VccOptions,
  VocabularyCollisionReport,
} from './types.js';

export function runVCC(input: VccInputBatch, options: VccOptions = {}): VocabularyCollisionReport {
  const collisions: Collision[] = [];
  const candidateLayer = options.candidateLayer ?? 'practice_area';

  // Index existing by termId, canonicalName, and (canonicalName, scope) for quick lookups.
  const existingById = new Map<string, CanonicalVocabularyEntry>();
  const existingByCanon = new Map<string, CanonicalVocabularyEntry[]>();
  for (const e of input.existing) {
    existingById.set(e.termId, e);
    const arr = existingByCanon.get(e.canonicalName.toLowerCase()) ?? [];
    arr.push(e);
    existingByCanon.set(e.canonicalName.toLowerCase(), arr);
  }

  for (const cand of input.candidates) {
    // Rule: CORE_REDEFINITION — candidate at higher layer redefines a core term
    if (existingById.has(cand.termId)) {
      const existing = existingById.get(cand.termId)!;
      if (existing.scope === 'core' && candidateLayer !== 'core') {
        collisions.push({
          rule: 'CORE_REDEFINITION',
          severity: 'BLOCK',
          leftTermId: cand.termId,
          rightTermId: existing.termId,
          message: `candidate at layer '${candidateLayer}' redefines core term ${cand.termId}`,
        });
      } else if (existing.scope === 'practice_area' && candidateLayer === 'firm') {
        collisions.push({
          rule: 'LENS_REDEFINITION',
          severity: 'BLOCK',
          leftTermId: cand.termId,
          rightTermId: existing.termId,
          message: `firm-layer candidate redefines practice-area term ${cand.termId}`,
        });
      }
    }

    // Rule: CANONICAL_NAME_COLLISION — different termId but same canonicalName at same scope token
    const sameCanon = existingByCanon.get(cand.canonicalName.toLowerCase()) ?? [];
    for (const e of sameCanon) {
      if (e.termId === cand.termId) continue;
      // A namespaced extension is allowed to register a same-canonical-name term in a different scope.
      // Collision is only flagged when both are core, or both are at the same layer.
      if (e.scope === 'core' && cand.scope === 'core') {
        collisions.push({
          rule: 'CANONICAL_NAME_COLLISION',
          severity: 'BLOCK',
          leftTermId: cand.termId,
          rightTermId: e.termId,
          message: `core canonicalName '${cand.canonicalName}' already defined by ${e.termId}`,
        });
      } else if (e.scope === cand.scope && e.scopeQualifier === cand.scopeQualifier) {
        collisions.push({
          rule: 'CANONICAL_NAME_COLLISION',
          severity: 'WARN',
          leftTermId: cand.termId,
          rightTermId: e.termId,
          message: `canonicalName '${cand.canonicalName}' shared with ${e.termId} at the same scope`,
        });
      }
    }

    // Rule: SYNONYM_PROHIBITED_OVERLAP — candidate's allowedSynonyms include a term another entry prohibits as synonym.
    const candSynLower = new Set(cand.allowedSynonyms.map((s) => s.toLowerCase()));
    for (const e of input.existing) {
      if (e.termId === cand.termId) continue;
      for (const prohib of e.prohibitedSynonyms) {
        if (candSynLower.has(prohib.toLowerCase())) {
          // If both are different terms, the candidate is asserting a synonym
          // another entry forbids → potential semantic collision.
          collisions.push({
            rule: 'SYNONYM_PROHIBITED_OVERLAP',
            severity: 'BLOCK',
            leftTermId: cand.termId,
            rightTermId: e.termId,
            message: `'${prohib}' is allowedSynonym of ${cand.termId} but prohibitedSynonym of ${e.termId}`,
          });
        }
      }
    }

    // Rule: SYNONYM_CROSS_TERM_OVERLAP — two distinct entries claim the same allowedSynonym
    for (const e of input.existing) {
      if (e.termId === cand.termId) continue;
      for (const s of e.allowedSynonyms) {
        if (candSynLower.has(s.toLowerCase()) && cand.canonicalName.toLowerCase() !== e.canonicalName.toLowerCase()) {
          collisions.push({
            rule: 'SYNONYM_CROSS_TERM_OVERLAP',
            severity: 'WARN',
            leftTermId: cand.termId,
            rightTermId: e.termId,
            message: `synonym '${s}' shared between ${cand.termId} and ${e.termId}`,
          });
        }
      }
    }

    // Rule: COLLISIONS_WITH_DECLARED — entry self-declares collisions
    for (const c of cand.collisionsWith ?? []) {
      if (existingById.has(c) || input.candidates.some((x) => x.termId === c)) {
        collisions.push({
          rule: 'COLLISIONS_WITH_DECLARED',
          severity: 'WARN',
          leftTermId: cand.termId,
          rightTermId: c,
          message: `${cand.termId} self-declares collision with ${c}`,
        });
      }
    }

    // Rule: JURISDICTION_VARIANCE — when activeJurisdictions are supplied and a term has variants
    if (input.activeJurisdictions && cand.jurisdictionVariants) {
      const variantKeys = Object.keys(cand.jurisdictionVariants);
      for (const j of input.activeJurisdictions) {
        if (!variantKeys.includes(j)) {
          collisions.push({
            rule: 'JURISDICTION_VARIANCE',
            severity: 'WARN_ACK',
            leftTermId: cand.termId,
            message: `${cand.termId} has jurisdiction variants but no entry for active jurisdiction '${j}'`,
          });
        }
      }
    }
  }

  const blockingCount = collisions.filter((c) => c.severity === 'BLOCK').length;
  const warnAckCount = collisions.filter((c) => c.severity === 'WARN_ACK').length;
  const warnCount = collisions.filter((c) => c.severity === 'WARN').length;

  let verdict: VocabularyCollisionReport['verdict'];
  if (blockingCount > 0) verdict = 'block';
  else if (warnAckCount > 0) verdict = 'allow_with_ack';
  else verdict = 'allow';

  return {
    reportId: randomUUID(),
    trigger: input.trigger,
    producedAt: new Date().toISOString(),
    collisions,
    blockingCount,
    warnAckCount,
    warnCount,
    verdict,
  };
}
