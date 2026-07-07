/**
 * Increment 4 — memory_edge traversal column fix.
 *
 * `ClientLiaisonDB.traverseEdges` / `getDownstreamDependencies` queried
 * `source_id` / `target_id`, but the memory_edge columns are
 * `source_record_id` / `target_record_id` (schema.ts) — so both methods
 * threw `no such column: source_id` at prepare() time and were effectively
 * dead. This test guards the fix: they prepare cleanly (no throw) and
 * traverse real edges. GPU-free (in-memory SQLite, no embedding calls).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ClientLiaisonDBImpl } from '../../../lib/agents/clientLiaison/db';

describe('memory_edge traversal column fix (Increment 4)', () => {
  let db: Database;
  let cdb: ClientLiaisonDBImpl;

  beforeEach(() => {
    db = createTestDatabase();
    // This test targets the traversal SQL column names, not referential
    // integrity — seed edges directly without materializing governed_stream
    // rows for their endpoints.
    (db as unknown as { pragma: (s: string) => void }).pragma('foreign_keys = OFF');
    cdb = new ClientLiaisonDBImpl(db, {} as never);
  });
  afterEach(() => db.close());

  it('traverseEdges prepares cleanly and returns [] on an empty graph', () => {
    expect(() => cdb.traverseEdges('missing')).not.toThrow();
    expect(cdb.traverseEdges('missing')).toEqual([]);
  });

  it('traverseEdges returns edges aliased to source_id/target_id, honoring the edge_type filter', () => {
    db.prepare(
      `INSERT INTO memory_edge
        (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('e1', 'A', 'B', 'derives_from', 'test', '2026-01-01T00:00:00Z', 6, 'accepted');

    const edges = cdb.traverseEdges('A');
    expect(edges).toHaveLength(1);
    expect(edges[0].source_id).toBe('A');
    expect(edges[0].target_id).toBe('B');
    expect(edges[0].edge_type).toBe('derives_from');

    expect(cdb.traverseEdges('A', 'derives_from')).toHaveLength(1);
    expect(cdb.traverseEdges('A', 'implements')).toHaveLength(0);
    // Rejected edges are excluded.
    db.prepare(
      `INSERT INTO memory_edge
        (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('e2', 'A', 'C', 'derives_from', 'test', '2026-01-01T00:00:00Z', 6, 'rejected');
    expect(cdb.traverseEdges('A')).toHaveLength(1);
  });

  it('getDownstreamDependencies prepares cleanly and returns [] on an empty graph', () => {
    expect(() => cdb.getDownstreamDependencies('missing')).not.toThrow();
    expect(cdb.getDownstreamDependencies('missing')).toEqual([]);
  });
});
