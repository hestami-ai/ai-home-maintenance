/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-6/.janumicode/test-harness/1778522570099.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();

// Sample a high-value record (artifact_produced) and check whether
// extractEmbeddingText would have produced text for it.
const samples = db.prepare(`
  SELECT id, record_type, sub_phase_id, content
    FROM governed_stream
   WHERE workflow_run_id = ?
     AND record_type IN ('artifact_produced', 'decision_trace', 'constitutional_invariant', 'agent_output')
     AND is_current_version = 1
   ORDER BY produced_at ASC
   LIMIT 5
`).all(run.id);

console.log('=== sample memory-bearing records ===');
for (const r of samples) {
  console.log(`\n[${r.record_type}] id=${r.id} sub_phase=${r.sub_phase_id}`);
  const c = JSON.parse(r.content);
  const keys = Object.keys(c).slice(0, 12).join(', ');
  console.log('  top-level keys:', keys);

  // Mirror extractEmbeddingText: skip SKIPPED types, recursively collect strings, skip NOISY keys
  const SKIPPED = new Set(['json_repair_record','file_system_write_record','mirror_presented','decision_bundle_presented','execution_wave_started','execution_wave_completed','workflow_run_closure']);
  const NOISY = new Set(['id','record_id','node_id','invariant_id','harness_id','parent_node_id','target_record_id','source_record_id','workflow_run_id','phase_id','sub_phase_id','janumicode_version_sha','started_at','produced_at','effective_at','embedded_at','superseded_at','duration_ms','input_tokens','output_tokens','tool_call_count','retry_attempts','used_fallback','response_format','tool_count','provider','model','temperature','max_tokens','tools','system','auto_approved','auto_approved_by','attribution']);
  if (SKIPPED.has(r.record_type)) { console.log('  → SKIPPED record_type, would not be embedded'); continue; }
  const parts = [];
  const walk = (v, depth) => {
    if (depth > 6) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.length >= 2 && s.length <= 4000) parts.push(s);
      return;
    }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth+1); return; }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (NOISY.has(k)) continue;
        walk(val, depth+1);
      }
    }
  };
  walk(c, 0);
  const joined = parts.join('\n');
  console.log('  extractable text length:', joined.length, 'chars (≥1 byte means embedder would call Ollama)');
  if (joined.length > 0) console.log('  preview:', joined.slice(0, 120).replace(/\n/g,' | '));
}

console.log('\n=== vec table schema ===');
try {
  const cols = db.prepare(`PRAGMA table_info(governed_stream_vec)`).all();
  for (const c of cols) console.log(' ', c.cid, c.name, c.type, c.notnull?'NOT NULL':'', c.dflt_value??'');
} catch (e) { console.log('  err:', e.message); }

console.log('\n=== vec table count + any rows ever ===');
const vecCount = db.prepare(`SELECT COUNT(*) c FROM governed_stream_vec`).get();
console.log('  rows:', vecCount.c);
