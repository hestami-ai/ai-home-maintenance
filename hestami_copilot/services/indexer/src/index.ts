/**
 * Indexer Service
 *
 * Watches the spec directory for changes and rebuilds the corpus index.
 * Syncs index data to the registry database.
 */

import { buildCorpusIndex } from '@hestami/corpus-tools';
import { Pool } from 'pg';

const SPECS_DIR = process.env['SPECS_DIR'] || '/specs';
const DATABASE_URL = process.env['DATABASE_URL'] || 'postgresql://hestami:hestami@registry-db:5432/historian_registry';
const POLL_INTERVAL_MS = parseInt(process.env['POLL_INTERVAL_MS'] || '30000', 10);

async function syncIndexToDatabase(pool: Pool, index: ReturnType<typeof buildCorpusIndex>): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Sync documents
    for (const docId of index.documents) {
      const entry = index.entries[docId];
      if (!entry) continue;

      await client.query(
        `INSERT INTO spec_documents (doc_id, title, file_path, content_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (doc_id) DO UPDATE SET
           title = EXCLUDED.title,
           file_path = EXCLUDED.file_path,
           content_hash = EXCLUDED.content_hash,
           updated_at = NOW()`,
        [docId, entry.title, entry.file_path, entry.quote_hash]
      );
    }

    // Sync sections
    for (const [stableId, entry] of Object.entries(index.entries)) {
      if (entry.type !== 'section') continue;

      await client.query(
        `INSERT INTO spec_sections (stable_id, doc_id, sec_id, heading, level, content, line_start, line_end, quote_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (stable_id) DO UPDATE SET
           heading = EXCLUDED.heading,
           content = EXCLUDED.content,
           line_start = EXCLUDED.line_start,
           line_end = EXCLUDED.line_end,
           quote_hash = EXCLUDED.quote_hash,
           updated_at = NOW()`,
        [stableId, entry.doc_id, entry.sec_id, entry.title, 1, entry.excerpt, entry.line_start, entry.line_end, entry.quote_hash]
      );
    }

    // Sync normatives
    for (const normative of index.normatives) {
      await client.query(
        `INSERT INTO normative_statements (stable_id, doc_id, sec_id, type, text, context, line_number, quote_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (stable_id) DO NOTHING`,
        [normative.stable_id, normative.doc_id, normative.sec_id, normative.type, normative.text, normative.context, normative.line_number, normative.quote_hash]
      );
    }

    await client.query('COMMIT');
    console.log(`Synced ${index.documents.length} documents, ${Object.keys(index.entries).length} entries, ${index.normatives.length} normatives`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function runIndexer(): Promise<void> {
  console.log('Indexer service starting...');
  console.log(`  Specs directory: ${SPECS_DIR}`);
  console.log(`  Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);

  const pool = new Pool({ connectionString: DATABASE_URL });

  // Initial index build
  try {
    console.log('\nBuilding initial index...');
    const index = buildCorpusIndex(SPECS_DIR);
    await syncIndexToDatabase(pool, index);
  } catch (err) {
    console.error('Initial index build failed:', err);
  }

  // Poll for changes
  setInterval(async () => {
    try {
      console.log('\nRebuilding index...');
      const index = buildCorpusIndex(SPECS_DIR);
      await syncIndexToDatabase(pool, index);
    } catch (err) {
      console.error('Index rebuild failed:', err);
    }
  }, POLL_INTERVAL_MS);
}

runIndexer().catch((err) => {
  console.error('Indexer service failed:', err);
  process.exit(1);
});
