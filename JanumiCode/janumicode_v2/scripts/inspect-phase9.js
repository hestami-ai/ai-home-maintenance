const Database = require('better-sqlite3');
const path = process.argv[2];
const db = new Database(path, { readonly: true });
console.log('=== PHASE 9 RECORDS ===');
const recs = db.prepare(`
  SELECT id, sub_phase_id, record_type, produced_by_agent_role,
         json_extract(content, '$.kind') as kind,
         length(content) as content_size
  FROM governed_stream
  WHERE phase_id='9' AND is_current_version=1
  ORDER BY produced_at
`).all();
for (const r of recs) console.log(r);
console.log('---');
console.log('=== PHASE 9 KIND COUNTS ===');
console.log(db.prepare(`
  SELECT sub_phase_id, json_extract(content, '$.kind') as kind, COUNT(*) n
  FROM governed_stream WHERE phase_id='9' AND is_current_version=1
  GROUP BY sub_phase_id, kind
`).all());
console.log('---');
console.log('=== ALL PHASE COUNTS ===');
console.log(db.prepare(`
  SELECT phase_id, COUNT(*) n FROM governed_stream WHERE is_current_version=1 GROUP BY phase_id ORDER BY phase_id
`).all());
console.log('---');
console.log('=== WORKFLOW STATE ===');
console.log(db.prepare('SELECT id, current_phase_id, current_sub_phase_id, status FROM workflow_runs').all());
