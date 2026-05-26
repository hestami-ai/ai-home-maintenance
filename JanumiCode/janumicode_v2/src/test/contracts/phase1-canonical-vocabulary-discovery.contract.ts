/**
 * Contract for Phase 1.0f — canonical_vocabulary_discovery
 * (artifact kind: `canonical_vocabulary_discovery`).
 *
 * Extracts the project's canonical vocabulary (domain terms, acronyms,
 * entity names). Downstream phases use this to normalize references
 * and detect drift.
 */

import type { ContractSuite } from './types';

export interface VocabularyTerm {
  term: string;
  definition?: string;
  aliases?: string[];
  category?: string;
}

export interface CanonicalVocabularyArtifact {
  kind: 'canonical_vocabulary_discovery';
  vocabulary?: VocabularyTerm[];
  vocabulary_extracted_items?: VocabularyTerm[];
  terms?: VocabularyTerm[];
}

function getTerms(a: CanonicalVocabularyArtifact): VocabularyTerm[] {
  return a.vocabulary ?? a.vocabulary_extracted_items ?? a.terms ?? [];
}

export const phase1CanonicalVocabularyContract: ContractSuite<CanonicalVocabularyArtifact> = {
  boundaryId: '1.0f_canonical_vocabulary_discovery',
  phaseId: '1',
  subPhaseId: 'canonical_vocabulary_discovery',
  producerArtifactKind: 'canonical_vocabulary_discovery',
  description:
    'Phase 1 canonical vocabulary — terms have non-empty names and unique within the artifact.',
  clauses: [
    {
      id: 'C-1.0f.1',
      description: 'vocabulary is an array (may be empty).',
      severity: 'blocking',
      check: (a) => {
        const items = getTerms(a);
        if (!Array.isArray(items)) return { message: 'vocabulary is not an array' };
        return true;
      },
    },
    {
      id: 'C-1.0f.2',
      description: 'Every term has a non-empty term string.',
      severity: 'blocking',
      check: (a) => {
        const items = getTerms(a);
        const bad = items.filter((t) => !t.term || t.term.trim().length === 0).length;
        if (bad === 0) return true;
        return { message: `${bad} term(s) have empty term field` };
      },
    },
    {
      id: 'C-1.0f.3',
      description: 'Term names are unique within the artifact (case-insensitive).',
      severity: 'advisory',
      check: (a) => {
        const items = getTerms(a);
        const counts = new Map<string, number>();
        for (const t of items) {
          const key = (t.term ?? '').toLowerCase();
          if (!key) continue;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
        if (dups.length === 0) return true;
        return { message: `duplicate terms: ${dups.join(', ')}`, details: { dups } };
      },
    },
    {
      id: 'C-1.0f.4',
      description: 'Every term has a non-empty definition.',
      severity: 'advisory',
      check: (a) => {
        const bad = getTerms(a).filter((t) => !t.definition || t.definition.trim().length === 0).map((t) => t.term);
        if (bad.length === 0) return true;
        return { message: `${bad.length} term(s) have no definition`, details: { terms: bad.slice(0, 10) } };
      },
    },
  ],
};
