#!/usr/bin/env node
/**
 * Verify the two-run semantic-supersession driver's output against the shared
 * DB: did the cross-run `supersedes` edge form, and did any run-2 DMR
 * context_packet surface it as a supersession_chain?
 *
 * Usage: node scripts/verify-two-run-supersession.mjs <shared-db-path>
 */
import Database from 'better-sqlite3';

const dbPath = process.argv[2];
if (!dbPath) {
  console.error('[verify] usage: verify-two-run-supersession.mjs <db>');
  process.exit(2);
}

const db = new Database(dbPath, { readonly: true });
const short = (id) => (id ? String(id).slice(0, 8) : '?');

const runs = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at').all();
console.log(`[verify] workflow runs in shared DB: ${runs.length}` +
  (runs.length >= 2 ? ' (cross-run scope active)' : ' (WARNING: expected 2 — runs did not share the DB)'));

const edges = db.prepare(
  "SELECT source_record_id, target_record_id, status FROM memory_edge WHERE edge_type='supersedes'",
).all();
console.log(`[verify] supersedes edges: ${edges.length}`);
for (const e of edges) {
  const src = db.prepare('SELECT record_type FROM governed_stream WHERE id=?').get(e.source_record_id);
  const tgt = db.prepare('SELECT record_type FROM governed_stream WHERE id=?').get(e.target_record_id);
  console.log(`    [${e.status}] ${short(e.source_record_id)} (${src?.record_type ?? '?'}) → supersedes → ${short(e.target_record_id)} (${tgt?.record_type ?? '?'})`);
}

const packets = db.prepare(
  "SELECT workflow_run_id, sub_phase_id, content FROM governed_stream WHERE record_type='context_packet' AND is_current_version=1",
).all();
let withChains = 0;
for (const p of packets) {
  let c;
  try { c = JSON.parse(p.content); } catch { continue; }
  const chains = c.supersession_chains ?? [];
  if (chains.length > 0) {
    withChains++;
    console.log(`[verify] context_packet ${p.sub_phase_id} (run ${short(p.workflow_run_id)}): ${chains.length} supersession_chain(s)`);
  }
}
console.log(`[verify] context_packets: ${packets.length} total, ${withChains} with supersession_chains`);

if (edges.length === 0) {
  console.log('[verify] RESULT: ✗ no supersedes edge — the override did not resolve its target or did not ingest. Confirm run 1 produced the targeted record (contentMatch).');
} else if (withChains > 0) {
  console.log(`[verify] RESULT: ✓ supersedes edge created AND surfaced in ${withChains} context_packet(s). Semantic supersession is live end-to-end.`);
} else {
  console.log('[verify] RESULT: ◐ supersedes edge created, but not surfaced in any packet — a RETRIEVAL outcome: the superseding artifact was not harvested by those phases\' DMR queries. The edge exists; query with the superseding record as known-relevant to see the chain.');
}
db.close();
