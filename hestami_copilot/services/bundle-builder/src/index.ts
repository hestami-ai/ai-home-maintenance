/**
 * Bundle Builder Service
 *
 * HTTP API for building evidence bundles from proposals.
 * Queries the spec index to find relevant citations.
 */

import express from 'express';
import { Pool } from 'pg';

const PORT = parseInt(process.env['PORT'] || '3001', 10);
const DATABASE_URL = process.env['DATABASE_URL'] || 'postgresql://hestami:hestami@registry-db:5432/historian_registry';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: DATABASE_URL });

interface BundleRequest {
  description: string;
  spec_refs?: string[];
  keywords?: string[];
  max_excerpts?: number;
}

interface EvidenceItem {
  source: 'spec' | 'guideline' | 'decision';
  id: string;
  excerpt: string;
  relevance_score: number;
}

/**
 * Search for relevant spec sections by keywords
 */
async function searchSpecs(keywords: string[], limit: number = 10): Promise<EvidenceItem[]> {
  const client = await pool.connect();
  try {
    // Simple keyword search in headings and content
    const query = `
      SELECT stable_id, heading, content, quote_hash
      FROM spec_sections
      WHERE ${keywords.map((_, i) => `(heading ILIKE $${i + 1} OR content ILIKE $${i + 1})`).join(' OR ')}
      LIMIT $${keywords.length + 1}
    `;
    const params = [...keywords.map((k) => `%${k}%`), limit];
    const result = await client.query(query, params);

    return result.rows.map((row, idx) => ({
      source: 'spec' as const,
      id: row.stable_id,
      excerpt: row.content?.substring(0, 500) || row.heading,
      relevance_score: 1 - idx / result.rows.length,
    }));
  } finally {
    client.release();
  }
}

/**
 * Fetch specific spec sections by stable IDs
 */
async function fetchByIds(stableIds: string[]): Promise<EvidenceItem[]> {
  if (stableIds.length === 0) return [];

  const client = await pool.connect();
  try {
    const query = `
      SELECT stable_id, heading, content
      FROM spec_sections
      WHERE stable_id = ANY($1)
    `;
    const result = await client.query(query, [stableIds]);

    return result.rows.map((row) => ({
      source: 'spec' as const,
      id: row.stable_id,
      excerpt: row.content?.substring(0, 500) || row.heading,
      relevance_score: 1.0,
    }));
  } finally {
    client.release();
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Build evidence bundle
app.post('/bundle', async (req, res) => {
  try {
    const body = req.body as BundleRequest;
    const maxExcerpts = body.max_excerpts || 10;

    const evidence: EvidenceItem[] = [];

    // Fetch by explicit spec refs first
    if (body.spec_refs && body.spec_refs.length > 0) {
      const refEvidence = await fetchByIds(body.spec_refs);
      evidence.push(...refEvidence);
    }

    // Search by keywords
    if (body.keywords && body.keywords.length > 0) {
      const keywordEvidence = await searchSpecs(body.keywords, maxExcerpts - evidence.length);
      evidence.push(...keywordEvidence);
    }

    // Extract keywords from description if none provided
    if (!body.keywords && evidence.length < maxExcerpts) {
      const descriptionWords = body.description
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 5);
      if (descriptionWords.length > 0) {
        const descEvidence = await searchSpecs(descriptionWords, maxExcerpts - evidence.length);
        evidence.push(...descEvidence);
      }
    }

    res.json({
      evidence_bundle: evidence.slice(0, maxExcerpts),
      total_found: evidence.length,
    });
  } catch (err) {
    console.error('Bundle build error:', err);
    res.status(500).json({ error: 'Failed to build evidence bundle' });
  }
});

app.listen(PORT, () => {
  console.log(`Bundle Builder service listening on port ${PORT}`);
});
