#!/usr/bin/env node
/**
 * Audit helper — read a pending pause marker, query the DB for what
 * that sub-phase produced, print a structured summary.
 *
 * Usage:
 *   node scripts/_audit-inspect.js <workspace-path> [seq]
 *
 * If seq is omitted, inspects the lowest-numbered pending marker.
 * Output: JSON summary {seq, run_id, prior_phase, prior_sub_phase,
 *   artifact_count, artifact_kinds, artifact_records[], other_records_by_type}.
 */
/* eslint-disable */
const fs = require('node:fs');
const path = require('node:path');
const Db = require('better-sqlite3');

function main() {
  const ws = process.argv[2];
  const seqArg = process.argv[3];
  if (!ws) { console.error('usage: _audit-inspect.js <workspace> [seq]'); process.exit(2); }
  const pendingDir = path.join(ws, '.janumicode', 'audit', 'pending');
  const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) { console.error('no pending markers'); process.exit(1); }
  const target = seqArg
    ? files.find(f => f.startsWith(String(seqArg).padStart(4, '0') + '__'))
    : files[0];
  if (!target) { console.error('no marker matching seq=' + seqArg); process.exit(1); }
  const marker = JSON.parse(fs.readFileSync(path.join(pendingDir, target), 'utf8'));
  const dbDir = path.join(ws, '.janumicode', 'test-harness');
  // DB selection: prefer the most recent resume-*.db over the original
  // numeric-named DB. The resume copy is the live one being written by
  // an in-flight resume; the original is frozen at its pre-resume state.
  // Without this preference, an audit query against a resume run would
  // silently read stale data from the original DB and miss the resume's
  // rollback + re-execution updates.
  const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'))
    .map(f => ({
      f,
      mtime: fs.statSync(path.join(dbDir, f)).mtimeMs,
      isResume: f.startsWith('resume-'),
    }));
  const resumes = dbFiles.filter(d => d.isResume).sort((a, b) => b.mtime - a.mtime);
  const originals = dbFiles.filter(d => !d.isResume).sort((a, b) => b.mtime - a.mtime);
  const dbFile = resumes[0] ?? originals[0];
  if (!dbFile) { console.error('no .db in ' + dbDir); process.exit(1); }
  const db = new Db(path.join(dbDir, dbFile.f), { readonly: true });
  if (process.env.JANUMICODE_AUDIT_INSPECT_VERBOSE === '1') {
    console.error('[audit-inspect] using DB:', dbFile.f);
  }

  const records = db.prepare(`
    SELECT id, record_type, json_extract(content, '$.kind') as kind,
           json_extract(content, '$.status') as status,
           produced_by_agent_role, length(content) as clen, content
      FROM governed_stream
     WHERE workflow_run_id = ? AND sub_phase_id = ? AND is_current_version = 1
     ORDER BY produced_at
  `).all(marker.workflow_run_id, marker.prior_sub_phase_id);

  const artifacts = records.filter(r => r.record_type === 'artifact_produced');
  const handoffs = records.filter(r =>
    r.record_type === 'product_description_handoff' ||
    r.record_type === 'narrative_handoff' ||
    r.record_type === 'context_handoff' ||
    /handoff/i.test(r.record_type)
  );
  const gates = records.filter(r => r.record_type === 'phase_gate_evaluation' || r.record_type === 'sub_phase_gate_evaluation');

  const byType = {};
  for (const r of records) byType[r.record_type] = (byType[r.record_type] || 0) + 1;

  const summary = {
    seq: marker.seq,
    marker_file: target,
    workflow_run_id: marker.workflow_run_id,
    prior_phase_id: marker.prior_phase_id,
    prior_sub_phase_id: marker.prior_sub_phase_id,
    next_sub_phase_id: marker.next_sub_phase_id,
    total_records: records.length,
    by_record_type: byType,
    artifact_count: artifacts.length,
    artifact_kinds: artifacts.map(a => a.kind).filter(Boolean),
    handoff_count: handoffs.length,
    gate_count: gates.length,
    artifacts: artifacts.map(a => ({ id: a.id.slice(0, 8), kind: a.kind, clen: a.clen })),
    handoffs: handoffs.map(h => ({ id: h.id.slice(0, 8), record_type: h.record_type, clen: h.clen })),
    gates: gates.map(g => ({ id: g.id.slice(0, 8), record_type: g.record_type, status: g.status, clen: g.clen })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
