const Database = require('better-sqlite3');
const db = new Database(process.argv[2], { readonly: true });

console.log('=== invocation_id field check (Phase 9.1) ===');
const recs = db.prepare(`
  SELECT id, record_type,
         json_extract(content, '$.invocation_id') as ci_invocation_id,
         json_extract(content, '$.agent_invocation_id') as ci_agent_invocation_id,
         json_extract(content, '$.task_id') as ci_task_id,
         json_extract(content, '$.implementation_task_id') as ci_impl_task_id
  FROM governed_stream
  WHERE phase_id='9' AND sub_phase_id='9.1' AND is_current_version=1
  ORDER BY produced_at
`).all();
const cols = {};
for (const r of recs) {
  const k = `${r.record_type}|ii=${!!r.ci_invocation_id}|aii=${!!r.ci_agent_invocation_id}|tid=${!!r.ci_task_id}|itid=${!!r.ci_impl_task_id}`;
  cols[k] = (cols[k] ?? 0) + 1;
}
console.log(cols);

console.log('\n=== distinct content.invocation_id ===');
console.log(db.prepare(`SELECT DISTINCT json_extract(content,'$.invocation_id') as iid FROM governed_stream WHERE phase_id='9' AND sub_phase_id='9.1' AND is_current_version=1 AND iid IS NOT NULL`).all());
console.log('=== distinct content.agent_invocation_id ===');
console.log(db.prepare(`SELECT DISTINCT json_extract(content,'$.agent_invocation_id') as aii FROM governed_stream WHERE phase_id='9' AND sub_phase_id='9.1' AND is_current_version=1 AND aii IS NOT NULL`).all());

console.log('\n=== schema for governed_stream ===');
console.log(db.prepare("PRAGMA table_info(governed_stream)").all().map(c=>c.name));
