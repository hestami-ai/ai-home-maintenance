/**
 * CLV public API.
 *
 * Runtime consumers receive a `CLV` interface backed by either an
 * in-memory store (tests) or the canonical_vocabulary table via ClvDal.
 */

import type { ClvDal } from '../database/clvDal.js';
import type { CanonicalVocabularyEntry, CLV } from './types.js';
import { CLV_V1_ENTRIES, CLV_V1_VERSION } from './entries/index.js';

export { InMemoryCLV } from './types.js';
export type { CLV, CanonicalVocabularyEntry, CLVScope } from './types.js';
export { loadCLVv1 } from './loader.js';
export { lintEntries } from './lint.js';
export type { LintFinding } from './lint.js';
export { CLV_V1_ENTRIES, CLV_V1_VERSION };

/**
 * DB-backed CLV implementation. Caches entries on first read for performance;
 * call `refresh()` after a CLV migration to reload.
 */
export class DbBackedCLV implements CLV {
  private cache: Map<string, CanonicalVocabularyEntry> | null = null;

  constructor(private readonly dal: ClvDal) {}

  private ensureCache(): Map<string, CanonicalVocabularyEntry> {
    if (this.cache) return this.cache;
    const m = new Map<string, CanonicalVocabularyEntry>();
    for (const e of this.dal.all()) m.set(e.termId, e);
    this.cache = m;
    return m;
  }

  refresh(): void {
    this.cache = null;
  }

  get(termId: string): CanonicalVocabularyEntry | undefined {
    return this.ensureCache().get(termId);
  }

  all(): readonly CanonicalVocabularyEntry[] {
    return Array.from(this.ensureCache().values());
  }

  has(termId: string): boolean {
    return this.ensureCache().has(termId);
  }

  search(query: string): readonly CanonicalVocabularyEntry[] {
    const q = query.toLowerCase();
    return this.all().filter(
      (e) =>
        e.termId.toLowerCase().includes(q) ||
        e.canonicalName.toLowerCase().includes(q) ||
        e.allowedSynonyms.some((s) => s.toLowerCase().includes(q)),
    );
  }
}
