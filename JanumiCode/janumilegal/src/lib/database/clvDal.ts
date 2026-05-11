/**
 * CLV DAL surface.
 *
 * Persistence for the canonical_vocabulary table. Lives in the database layer
 * (not the CLV module) so the layer linter's R3/R4 rules can hold without
 * exception: only src/lib/database/** may execute SQL.
 *
 * The CLV is an unscoped registry — entries are platform-wide.
 */

import type Database from 'better-sqlite3';
import type { CanonicalVocabularyEntry } from '../clv/types.js';

export class ClvDal {
  constructor(private readonly db: Database.Database) {}

  /** Returns the count of entries currently in the table. */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM canonical_vocabulary').get() as { n: number };
    return row.n;
  }

  /** Has a specific termId. */
  has(termId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM canonical_vocabulary WHERE term_id = ?').get(termId);
    return !!row;
  }

  /** Insert a single entry. Throws if termId already exists. */
  insert(entry: CanonicalVocabularyEntry): void {
    this.db
      .prepare(
        `INSERT INTO canonical_vocabulary
         (term_id, canonical_name, one_line_definition, long_definition, scope, scope_qualifier,
          allowed_synonyms_json, prohibited_synonyms_json, jurisdiction_variants_json, collisions_with_json,
          example_usage_json, example_misuse_json, governing_authority, version, supersedes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.termId,
        entry.canonicalName,
        entry.oneLineDefinition,
        entry.longDefinition,
        entry.scope,
        entry.scopeQualifier ?? null,
        JSON.stringify(entry.allowedSynonyms),
        JSON.stringify(entry.prohibitedSynonyms),
        JSON.stringify(entry.jurisdictionVariants ?? {}),
        JSON.stringify(entry.collisionsWith ?? []),
        JSON.stringify(entry.exampleUsage),
        JSON.stringify(entry.exampleMisuse),
        entry.governingAuthority ?? null,
        entry.version,
        entry.supersedes ?? null,
        new Date().toISOString(),
      );
  }

  /** Bulk insert in a single transaction; idempotent — skips existing termIds. */
  loadIfMissing(entries: readonly CanonicalVocabularyEntry[]): { inserted: number; skipped: number } {
    let inserted = 0;
    let skipped = 0;
    const txn = this.db.transaction((batch: readonly CanonicalVocabularyEntry[]) => {
      for (const e of batch) {
        if (this.has(e.termId)) {
          skipped++;
          continue;
        }
        this.insert(e);
        inserted++;
      }
    });
    txn(entries);
    return { inserted, skipped };
  }

  /** Read a single entry. */
  get(termId: string): CanonicalVocabularyEntry | undefined {
    const row = this.db.prepare('SELECT * FROM canonical_vocabulary WHERE term_id = ?').get(termId) as
      | DbRow
      | undefined;
    if (!row) return undefined;
    return rowToEntry(row);
  }

  /** Read all entries. */
  all(): CanonicalVocabularyEntry[] {
    const rows = this.db.prepare('SELECT * FROM canonical_vocabulary').all() as DbRow[];
    return rows.map(rowToEntry);
  }
}

interface DbRow {
  term_id: string;
  canonical_name: string;
  one_line_definition: string;
  long_definition: string;
  scope: string;
  scope_qualifier: string | null;
  allowed_synonyms_json: string;
  prohibited_synonyms_json: string;
  jurisdiction_variants_json: string;
  collisions_with_json: string;
  example_usage_json: string;
  example_misuse_json: string;
  governing_authority: string | null;
  version: string;
  supersedes: string | null;
}

function rowToEntry(row: DbRow): CanonicalVocabularyEntry {
  const variants = JSON.parse(row.jurisdiction_variants_json) as Record<string, string>;
  const collisions = JSON.parse(row.collisions_with_json) as string[];
  return {
    termId: row.term_id,
    canonicalName: row.canonical_name,
    oneLineDefinition: row.one_line_definition,
    longDefinition: row.long_definition,
    scope: row.scope as CanonicalVocabularyEntry['scope'],
    scopeQualifier: row.scope_qualifier ?? undefined,
    allowedSynonyms: JSON.parse(row.allowed_synonyms_json) as string[],
    prohibitedSynonyms: JSON.parse(row.prohibited_synonyms_json) as string[],
    jurisdictionVariants: Object.keys(variants).length ? variants : undefined,
    collisionsWith: collisions.length ? collisions : undefined,
    exampleUsage: JSON.parse(row.example_usage_json) as string[],
    exampleMisuse: JSON.parse(row.example_misuse_json) as string[],
    governingAuthority: row.governing_authority ?? undefined,
    version: row.version,
    supersedes: row.supersedes ?? undefined,
  };
}
