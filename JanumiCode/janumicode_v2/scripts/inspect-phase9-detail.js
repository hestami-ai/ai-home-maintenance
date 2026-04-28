const Database = require('better-sqlite3');
const db = new Database(process.argv[2], { readonly: true });

console.log('=== FILE SYSTEM WRITES (Phase 9) ===');
const fws = db.prepare(`
  SELECT id, content FROM governed_stream
  WHERE phase_id='9' AND record_type='file_system_write_record' AND is_current_version=1
`).all();
for (const r of fws) {
  console.log('---');
  console.log(JSON.parse(r.content));
}

console.log('\n=== EXECUTION SUMMARY ===');
const es = db.prepare(`
  SELECT content FROM governed_stream
  WHERE phase_id='9' AND record_type='artifact_produced'
    AND json_extract(content,'$.kind')='execution_summary' AND is_current_version=1
`).all();
for (const r of es) console.log(JSON.parse(r.content));

console.log('\n=== REASONING REVIEW RESULT ===');
const rr = db.prepare(`
  SELECT content FROM governed_stream
  WHERE phase_id='9' AND json_extract(content,'$.kind')='reasoning_review_result'
    AND is_current_version=1
`).all();
for (const r of rr) console.log(JSON.parse(r.content));

console.log('\n=== REASONING REVIEW AGENT_OUTPUT (full) ===');
const ao = db.prepare(`
  SELECT content FROM governed_stream
  WHERE phase_id='9' AND record_type='agent_output'
    AND produced_by_agent_role='reasoning_review' AND is_current_version=1
`).all();
for (const r of ao) console.log(JSON.parse(r.content));

console.log('\n=== PHASE 10 ARTIFACTS ===');
const p10 = db.prepare(`
  SELECT id, sub_phase_id, record_type, produced_by_agent_role,
         json_extract(content,'$.kind') as kind, length(content) as size
  FROM governed_stream WHERE phase_id='10' AND is_current_version=1
`).all();
for (const r of p10) console.log(r);
