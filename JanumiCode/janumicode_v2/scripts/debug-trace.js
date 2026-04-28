const Database = require('better-sqlite3');
const db = new Database(process.argv[2], { readonly: true });
const wfid = 'f16a7853-9d60-47b1-bf94-579087d64b60';
const iid = '2331d527-e649-4740-a672-ee4a88589a15';

const recs = db.prepare(`
  SELECT * FROM governed_stream
  WHERE workflow_run_id = ? AND phase_id = '9' AND sub_phase_id = '9.1'
    AND is_current_version = 1
    AND (
      produced_by_record_id = ?
      OR (record_type = 'agent_invocation' AND json_extract(content, '$.invocation_id') = ?)
    )
  ORDER BY produced_at ASC
`).all(wfid, iid, iid);

console.log('rows:', recs.length);
console.log('column names from row 0:', Object.keys(recs[0] || {}));
console.log('row0.id:', recs[0]?.id);
console.log('row0.record_type:', recs[0]?.record_type);
console.log('row0.content (first 100 chars):', String(recs[0]?.content).slice(0, 100));

const typeMap = { agent_reasoning_step: 'agent_reasoning_step', agent_self_correction: 'agent_self_correction', tool_call: 'tool_call', tool_result: 'tool_result' };
const traceRecords = recs.filter(r => r.record_type in typeMap).map((r, i) => ({
  id: r.id, type: typeMap[r.record_type], content: r.content, sequencePosition: i,
  tokenCount: Math.ceil(r.content.length / 4),
}));
console.log('traceRecords passed to ContextBuilder:', traceRecords.length);
console.log('types:', traceRecords.reduce((a,r) => { a[r.type] = (a[r.type]||0)+1; return a; }, {}));
console.log('total tokens estimate:', traceRecords.reduce((a,r)=>a+r.tokenCount, 0));
