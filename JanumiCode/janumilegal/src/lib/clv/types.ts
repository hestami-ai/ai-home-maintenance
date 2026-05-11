/**
 * Canonical Legal Vocabulary (CLV) — runtime types and interface.
 *
 * Per:
 *   - docs/janumilegal_product_description_evolution.md §1
 *   - docs/clv/canonical_vocabulary_v1.md
 *
 * Wave 0: types + interface. Wave 1: storage backed by canonical_vocabulary
 * table + generator that loads from clv/canonical_vocabulary_v1.md.
 */

export type CLVScope = 'core' | 'practice_area' | 'jurisdiction' | 'firm';

export interface CanonicalVocabularyEntry {
  readonly termId: string;
  readonly canonicalName: string;
  readonly oneLineDefinition: string;
  readonly longDefinition: string;
  readonly scope: CLVScope;
  readonly scopeQualifier?: string;
  readonly allowedSynonyms: readonly string[];
  readonly prohibitedSynonyms: readonly string[];
  readonly jurisdictionVariants?: Readonly<Record<string, string>>;
  readonly collisionsWith?: readonly string[];
  readonly exampleUsage: readonly string[];
  readonly exampleMisuse: readonly string[];
  readonly governingAuthority?: string;
  readonly version: string;
  readonly supersedes?: string;
}

export interface CLV {
  /** Lookup by termId. Returns undefined if not present. */
  get(termId: string): CanonicalVocabularyEntry | undefined;

  /** Returns all entries. */
  all(): readonly CanonicalVocabularyEntry[];

  /** True if a term exists. */
  has(termId: string): boolean;

  /** Returns terms whose canonicalName, allowedSynonyms, or termId matches the query. */
  search(query: string): readonly CanonicalVocabularyEntry[];
}

/**
 * Wave 0 in-memory CLV stub. Wave 1 replaces with a DB-backed implementation
 * loaded from the canonical_vocabulary table.
 */
export class InMemoryCLV implements CLV {
  private readonly byId = new Map<string, CanonicalVocabularyEntry>();

  load(entries: readonly CanonicalVocabularyEntry[]): void {
    for (const e of entries) {
      this.byId.set(e.termId, e);
    }
  }

  get(termId: string): CanonicalVocabularyEntry | undefined {
    return this.byId.get(termId);
  }

  all(): readonly CanonicalVocabularyEntry[] {
    return Array.from(this.byId.values());
  }

  has(termId: string): boolean {
    return this.byId.has(termId);
  }

  search(query: string): readonly CanonicalVocabularyEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.byId.values()).filter(
      (e) =>
        e.termId.toLowerCase().includes(q) ||
        e.canonicalName.toLowerCase().includes(q) ||
        e.allowedSynonyms.some((s) => s.toLowerCase().includes(q)),
    );
  }
}
