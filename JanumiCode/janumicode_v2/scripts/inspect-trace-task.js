const Database = require('better-sqlite3');
const db = new Database(process.argv[2], { readonly: true });

console.log('=== records WITH task_id field at top of content (Phase 9.1) ===');
const withTaskId = db.prepare(`
  SELECT id, record_type, json_extract(content, '$.task_id') as task_id,
         json_extract(content, '$.implementation_task_id') as impl_task_id,
         json_extract(content, '$.invocation_id') as invocation_id,
         length(content) as size
  FROM governed_stream
  WHERE phase_id='9' AND sub_phase_id='9.1' AND is_current_version=1
  ORDER BY produced_at
`).all();
let withCnt = 0, implCnt = 0, neither = 0;
for (const r of withTaskId) {
  if (r.task_id) withCnt++;
  else if (r.impl_task_id) implCnt++;
  else neither++;
}
console.log(`task_id present: ${withCnt}, implementation_task_id present: ${implCnt}, neither: ${neither}, total: ${withTaskId.length}`);
console.log('Sample of records by record_type and task_id presence:');
const grouped = {};
for (const r of withTaskId) {
  const key = `${r.record_type}|task_id=${!!r.task_id}|impl=${!!r.impl_task_id}`;
  grouped[key] = (grouped[key] ?? 0) + 1;
}
console.log(grouped);

console.log('\n=== Sample agent_reasoning_step content keys ===');
const sample = db.prepare(`
  SELECT content FROM governed_stream
  WHERE phase_id='9' AND record_type='agent_reasoning_step' AND is_current_version=1 LIMIT 2
`).all();
for (const r of sample) {
  const c = JSON.parse(r.content);
  console.log('keys:', Object.keys(c));
}
